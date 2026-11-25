"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  WOCHENTAGE,
  aendereBeginn,
  aendereEnde,
  lokalesDatum,
  schichtartZeiten,
  type ArbeitszeitBefund,
  type EntwurfKonflikt,
  type EntwurfVorschlag,
  type PlanEntwurf,
  type PlanEntwurfItem,
  type PlanLuecke,
  type SchichtartItem,
  type ShiftItem,
  type Zeiten,
  verschiebeSchicht,
} from "@ah-intranet/shared";
import {
  entwurfVorschlagAction,
  loescheEntwurfAction,
  speichereEntwurfAction,
  veroeffentlicheEntwurfAction,
} from "@/lib/actions";
import { Zeitraster, type Block } from "./zeitraster";

type Status = "gespeichert" | "ungespeichert" | "speichert" | "fehler";

const knopf =
  "rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50";

function tagKurz(datum: string): string {
  return new Date(`${datum}T00:00:00Z`).toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
}

function uhrzeit(iso: string): string {
  return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
}

/** Echte Schicht → Element des Entwurfs. */
function ausEchterSchicht(schicht: ShiftItem): PlanEntwurfItem {
  return {
    key: crypto.randomUUID(),
    liveId: schicht.id,
    liveStand: schicht.updatedAt ?? null,
    label: schicht.label,
    startsAt: schicht.startsAt,
    endsAt: schicht.endsAt,
    pauseMinuten: schicht.pauseMinuten ?? 0,
    assigneeId: schicht.assigneeId ?? null,
    schichtartId: schicht.schichtartId ?? null,
    locationId: schicht.locationId ?? null,
    departmentId: schicht.departmentId ?? null,
    note: schicht.note ?? null,
  };
}

/** Weicht das Element von der echten Schicht ab? */
function weichtAb(item: PlanEntwurfItem, echt: ShiftItem): boolean {
  return (
    item.label !== echt.label ||
    new Date(item.startsAt).getTime() !== new Date(echt.startsAt).getTime() ||
    new Date(item.endsAt).getTime() !== new Date(echt.endsAt).getTime() ||
    (item.assigneeId ?? null) !== (echt.assigneeId ?? null) ||
    item.pauseMinuten !== (echt.pauseMinuten ?? 0) ||
    (item.note ?? null) !== (echt.note ?? null)
  );
}

/**
 * Ein Dienstplan in Arbeit - die einzige Art, den Plan zu ändern.
 *
 * Alles hier ist ein Entwurf: er liegt auf dem Server, aber nicht im echten Plan, und löst keine
 * Meldung aus. Änderungen werden nach kurzer Pause **automatisch als Entwurf** gespeichert.
 * Erst „Plan speichern und melden" wendet alles in einem Zug an, und jede betroffene Person
 * erfährt es einmal.
 */
export function Entwurfsplan({
  start,
  tage,
  heute,
  live,
  freieTage,
  people,
  arten,
  meId,
}: {
  start: PlanEntwurf;
  tage: string[];
  heute: string;
  live: ShiftItem[];
  freieTage: Record<string, string>;
  people: { id: string; name: string }[];
  arten: SchichtartItem[];
  meId: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(start.items);
  const [name, setName] = useState(start.name);
  const [version, setVersion] = useState(start.version);
  const [status, setStatus] = useState<Status>("gespeichert");
  const [gespeichertUm, setGespeichertUm] = useState<Date | null>(null);
  const [befunde, setBefunde] = useState<ArbeitszeitBefund[]>(start.pruefung?.befunde ?? []);
  const [konflikte, setKonflikte] = useState<EntwurfKonflikt[]>(start.pruefung?.konflikte ?? []);
  const [fehler, setFehler] = useState<string | null>(null);
  const [auswahl, setAuswahl] = useState<string | null>(null);
  const [panel, setPanel] = useState<"hinzu" | "auto" | null>(null);
  const [luecken, setLuecken] = useState<PlanLuecke[]>([]);
  const [ohneStunden, setOhneStunden] = useState<string[]>([]);
  const [davor, setDavor] = useState<PlanEntwurfItem[] | null>(null);
  const [arbeitet, setArbeitet] = useState(false);

  // Aktueller Stand in Refs: das Autospeichern läuft zeitversetzt und darf nie einen alten Stand schreiben.
  const itemsRef = useRef(items);
  const nameRef = useRef(name);
  const versionRef = useRef(version);
  const geaendertRef = useRef(false);
  const laeuftRef = useRef(false);
  const blockiertRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const liveNachId = useMemo(() => new Map(live.map((schicht) => [schicht.id, schicht])), [live]);
  const personName = useMemo(() => new Map(people.map((person) => [person.id, person.name])), [people]);

  /* -------------------------------------------------------- Speichern */

  const speichereJetzt = async (): Promise<boolean> => {
    if (blockiertRef.current) return false;
    if (laeuftRef.current) {
      // Eine Speicherung läuft schon: ihr Ergebnis abwarten, dann ggf. noch einmal.
      while (laeuftRef.current) await new Promise((fertig) => setTimeout(fertig, 50));
    }
    while (geaendertRef.current) {
      geaendertRef.current = false;
      laeuftRef.current = true;
      setStatus("speichert");
      const ergebnis = await speichereEntwurfAction(start.id, versionRef.current, nameRef.current, itemsRef.current);
      laeuftRef.current = false;
      if (!ergebnis.ok) {
        geaendertRef.current = true;
        setStatus("fehler");
        setFehler(
          ergebnis.konflikt
            ? ergebnis.message
            : `Nicht gespeichert: ${ergebnis.message} Ihre Änderungen bleiben hier stehen; die nächste Änderung versucht es erneut.`,
        );
        // Bei Versionskonflikt nicht blind weiterschreiben: zwei Fassungen würden einander überschreiben.
        blockiertRef.current = Boolean(ergebnis.konflikt);
        return false;
      }
      versionRef.current = ergebnis.version;
      setVersion(ergebnis.version);
      setBefunde(ergebnis.befunde);
      setKonflikte(ergebnis.konflikte);
      setFehler(null);
      setGespeichertUm(new Date());
    }
    setStatus("gespeichert");
    return true;
  };

  const plane = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void speichereJetzt(), 1500);
  };

  /** Jede Änderung am Entwurf geht hierüber: Stand aktualisieren, zum Autospeichern vormerken. */
  const aendere = (fn: (alt: PlanEntwurfItem[]) => PlanEntwurfItem[]) => {
    const neu = fn(itemsRef.current);
    itemsRef.current = neu;
    setItems(neu);
    geaendertRef.current = true;
    setStatus("ungespeichert");
    plane();
  };

  const aendereItem = (key: string, fn: (item: PlanEntwurfItem) => PlanEntwurfItem) =>
    aendere((alt) => alt.map((item) => (item.key === key ? fn(item) : item)));

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  // Beim Verlassen mit noch nicht gespeicherten Änderungen warnen (zwischen zwei Autospeicherungen).
  useEffect(() => {
    if (status === "gespeichert") return;
    const vorVerlassen = (ereignis: BeforeUnloadEvent) => ereignis.preventDefault();
    window.addEventListener("beforeunload", vorVerlassen);
    return () => window.removeEventListener("beforeunload", vorVerlassen);
  }, [status]);

  /* -------------------------------------------------------------- Blöcke */

  const aktive = useMemo(() => items.filter((item) => !item.geloescht), [items]);
  const entfernte = useMemo(() => items.filter((item) => item.geloescht), [items]);

  const bloecke = useMemo<Block[]>(() => {
    const ersetzt = new Set(items.map((item) => item.liveId).filter(Boolean));
    const alle = [
      ...live
        .filter((schicht) => !ersetzt.has(schicht.id))
        .map((schicht) => ({
          key: schicht.id,
          startsAt: schicht.startsAt,
          endsAt: schicht.endsAt,
          label: schicht.label,
          personId: schicht.assigneeId ?? null,
          person: schicht.assignee ?? null,
          mine: Boolean(schicht.mine),
          status: "fest" as const,
          editierbar: false,
        })),
      ...aktive.map((item) => {
        const echt = item.liveId ? liveNachId.get(item.liveId) : undefined;
        return {
          key: item.key,
          startsAt: item.startsAt,
          endsAt: item.endsAt,
          label: item.label,
          personId: item.assigneeId,
          person: item.assigneeId ? (personName.get(item.assigneeId) ?? "?") : null,
          mine: item.assigneeId === meId,
          status: (!item.liveId
            ? "neu"
            : echt && weichtAb(item, echt)
              ? "geaendert"
              : "unveraendert") as Block["status"],
          editierbar: true,
        };
      }),
    ];

    // Doppelt belegt: dieselbe Person zweimal zur selben Zeit - schon während des Ziehens sichtbar.
    const doppelt = new Set<string>();
    for (const a of alle) {
      for (const b of alle) {
        if (
          a.key !== b.key &&
          a.personId &&
          a.personId === b.personId &&
          a.startsAt < b.endsAt &&
          a.endsAt > b.startsAt
        ) {
          doppelt.add(a.key);
        }
      }
    }
    const marken = new Map<string, "verstoss" | "hinweis">();
    for (const befund of befunde) {
      const schluessel = `${befund.userId}|${befund.datum}`;
      if (marken.get(schluessel) !== "verstoss") marken.set(schluessel, befund.schwere);
    }
    return alle.map(({ personId, ...rest }) => ({
      ...rest,
      konflikt: doppelt.has(rest.key),
      marke: personId ? marken.get(`${personId}|${lokalesDatum(new Date(rest.startsAt))}`) : undefined,
    }));
  }, [items, live, aktive, liveNachId, personName, meId, befunde]);

  const hatKonflikt = bloecke.some((block) => block.konflikt) || konflikte.length > 0;

  /* ----------------------------------------------------------- Aktionen */

  const neuAnlegen = (liste: Omit<PlanEntwurfItem, "key" | "liveId" | "liveStand" | "geloescht">[]) =>
    aendere((alt) => [
      ...alt,
      ...liste.map((eintrag) => ({ ...eintrag, key: crypto.randomUUID(), liveId: null, liveStand: null })),
    ]);

  const befuelle = async (ids: string[]) => {
    setArbeitet(true);
    setFehler(null);
    const ergebnis = await entwurfVorschlagAction({
      von: tage[0] < start.von ? start.von : tage[0],
      bis: tage[6] > start.bis ? start.bis : tage[6],
      schichtartIds: ids,
      items: itemsRef.current,
    });
    setArbeitet(false);
    if (!ergebnis.ok) {
      setFehler(ergebnis.message);
      return;
    }
    const vorschlag: EntwurfVorschlag = ergebnis;
    setDavor(itemsRef.current);
    const entfernen = new Set(vorschlag.entfernen);
    aendere((alt) => [
      // Offene Elemente, die der Vorschlag ersetzt: neue verschwinden, echte werden zum Entfernen vorgemerkt.
      ...alt.flatMap((item) =>
        entfernen.has(item.key) ? (item.liveId ? [{ ...item, geloescht: true }] : []) : [item],
      ),
      ...vorschlag.neu,
    ]);
    setLuecken(vorschlag.luecken);
    setOhneStunden(vorschlag.ohneWochenstunden);
  };

  const rueckgaengig = () => {
    if (!davor) return;
    aendere(() => davor);
    setDavor(null);
    setLuecken([]);
  };

  const verwerfen = async () => {
    if (!window.confirm(`Entwurf "${name}" verwerfen? Der echte Plan bleibt unverändert.`)) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    blockiertRef.current = true;
    const ergebnis = await loescheEntwurfAction(start.id);
    if (!ergebnis.ok) {
      blockiertRef.current = false;
      setFehler(ergebnis.message ?? "Der Entwurf konnte nicht verworfen werden.");
      return;
    }
    router.push(`/schichtplan/woche?datum=${tage[0]}`);
  };

  const zusammenfassung = useMemo(() => {
    const neu = aktive.filter((item) => !item.liveId).length;
    const geaendert = aktive.filter((item) => {
      const echt = item.liveId ? liveNachId.get(item.liveId) : undefined;
      return echt && weichtAb(item, echt);
    }).length;
    return { neu, geaendert, entfernt: entfernte.length };
  }, [aktive, entfernte, liveNachId]);
  const aenderungen = zusammenfassung.neu + zusammenfassung.geaendert + zusammenfassung.entfernt;

  const veroeffentlichen = async () => {
    setFehler(null);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!(await speichereJetzt())) return;
    if (
      !window.confirm(
        `Plan speichern und melden?\n\n${zusammenfassung.neu} neu, ${zusammenfassung.geaendert} geändert, ${zusammenfassung.entfernt} entfernt.\n` +
          "Jede betroffene Person bekommt einmal eine Meldung (Intranet und Mail).",
      )
    ) {
      return;
    }
    setArbeitet(true);
    const ergebnis = await veroeffentlicheEntwurfAction(start.id, versionRef.current);
    setArbeitet(false);
    if (!ergebnis.ok) {
      setFehler(ergebnis.message);
      return;
    }
    blockiertRef.current = true;
    const info = `Plan gespeichert: ${ergebnis.angelegt} neu, ${ergebnis.geaendert} geändert, ${ergebnis.entfernt} entfernt - ${ergebnis.benachrichtigt} Person(en) benachrichtigt.`;
    router.push(`/schichtplan/woche?datum=${tage[0]}&info=${encodeURIComponent(info)}`);
  };

  const gewaehlterBlock = auswahl ? bloecke.find((block) => block.key === auswahl) : undefined;
  const gewaehltesItem = auswahl ? items.find((item) => item.key === auswahl) : undefined;
  const gewaehlteEchte = auswahl ? live.find((schicht) => schicht.id === auswahl) : undefined;

  /* -------------------------------------------------------------- Ansicht */

  const statusText =
    status === "speichert"
      ? "Speichert …"
      : status === "ungespeichert"
        ? "Änderungen noch nicht als Entwurf gespeichert"
        : status === "fehler"
          ? "Entwurf nicht gespeichert"
          : gespeichertUm
            ? `Entwurf gespeichert um ${gespeichertUm.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr`
            : "Entwurf gespeichert";

  return (
    <div className="space-y-4">
      {fehler ? (
        <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {fehler}
        </p>
      ) : null}

      <div className="space-y-3 rounded-2xl border border-brand-300 bg-white px-3 py-3 shadow-lg sm:px-4 lg:sticky lg:top-2 lg:z-30">
        <div className="flex flex-wrap items-center gap-3">
          <span className="badge bg-brand-100 text-brand-800">Entwurf</span>
          <input
            value={name}
            onChange={(ereignis) => {
              setName(ereignis.target.value);
              nameRef.current = ereignis.target.value;
              geaendertRef.current = true;
              setStatus("ungespeichert");
              plane();
            }}
            aria-label="Name des Entwurfs"
            className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1 text-sm sm:border-transparent font-semibold text-slate-900 hover:border-slate-200"
          />
          <span
            className={`text-xs ${status === "fehler" ? "font-semibold text-rose-700" : "text-slate-500"}`}
            role="status"
          >
            {statusText}
          </span>
        </div>
        <p className="text-xs text-slate-500">
          Das ist ein Entwurf: der echte Plan bleibt unverändert und <strong>niemand wird benachrichtigt</strong>, bis
          Sie „Plan speichern und melden“ drücken. Änderungen werden zwischendurch automatisch als Entwurf gesichert.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={knopf} onClick={() => setPanel(panel === "hinzu" ? null : "hinzu")}>
            + Schicht hinzufügen
          </button>
          <button type="button" className={knopf} onClick={() => setPanel(panel === "auto" ? null : "auto")}>
            Automatisch befüllen
          </button>
          <button
            type="button"
            className={knopf}
            disabled={status === "speichert"}
            onClick={() => void speichereJetzt()}
          >
            Entwurf speichern
          </button>
          <span className="hidden flex-1 sm:block" />
          <button
            type="button"
            onClick={() => void verwerfen()}
            className="text-xs font-semibold text-red-700 hover:underline"
          >
            Entwurf verwerfen
          </button>
          <button
            type="button"
            disabled={arbeitet || hatKonflikt || aenderungen === 0 || status === "fehler"}
            onClick={() => void veroeffentlichen()}
            className="w-full rounded-xl bg-brand-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50 sm:w-auto"
          >
            Plan speichern und melden
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Gegenüber dem Plan: {zusammenfassung.neu} neu, {zusammenfassung.geaendert} geändert,{" "}
          {zusammenfassung.entfernt} entfernt.
          {hatKonflikt ? (
            <span className="ml-2 font-semibold text-rose-700">
              Überschneidungen derselben Person (schraffiert) verhindern das Speichern.
            </span>
          ) : null}
        </p>
      </div>

      {panel === "hinzu" ? (
        <SchichtHinzufuegen tage={tage} arten={arten} onHinzu={neuAnlegen} onSchliessen={() => setPanel(null)} />
      ) : null}
      {panel === "auto" ? (
        <Befuellen
          arten={arten}
          arbeitet={arbeitet}
          davor={davor !== null}
          luecken={luecken}
          ohneStunden={ohneStunden}
          onBefuelle={(ids) => void befuelle(ids)}
          onRueckgaengig={rueckgaengig}
        />
      ) : null}

      <Zeitraster
        tage={tage}
        heute={heute}
        bloecke={bloecke}
        freieTage={freieTage}
        auswahl={auswahl}
        onWaehle={setAuswahl}
        onAendere={(key, neu: Zeiten) => aendereItem(key, (item) => ({ ...item, ...neu }))}
      />

      {gewaehltesItem && gewaehlterBlock ? (
        <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-semibold text-slate-900">{gewaehltesItem.label}</p>
            <p className="text-sm text-slate-600">
              {tagKurz(lokalesDatum(new Date(gewaehltesItem.startsAt)))} · {uhrzeit(gewaehltesItem.startsAt)}–
              {uhrzeit(gewaehltesItem.endsAt)} Uhr
            </p>
          </div>
          {/* Auf dem Telefon wird nicht gezogen - die Zeiten ändern sich hier in Schritten. */}
          <div className="grid grid-cols-2 gap-2 md:hidden">
            {(
              [
                ["Beginn früher", (z: Zeiten) => aendereBeginn(z, -15)],
                ["Beginn später", (z: Zeiten) => aendereBeginn(z, 15)],
                ["Ende früher", (z: Zeiten) => aendereEnde(z, -15)],
                ["Ende später", (z: Zeiten) => aendereEnde(z, 15)],
                ["Eine Viertelstunde früher", (z: Zeiten) => verschiebeSchicht(z, 0, -15)],
                ["Eine Viertelstunde später", (z: Zeiten) => verschiebeSchicht(z, 0, 15)],
                ["Einen Tag früher", (z: Zeiten) => verschiebeSchicht(z, -1, 0)],
                ["Einen Tag später", (z: Zeiten) => verschiebeSchicht(z, 1, 0)],
              ] as [string, (z: Zeiten) => Zeiten][]
            ).map(([text, rechne]) => (
              <button
                key={text}
                type="button"
                className={knopf}
                onClick={() =>
                  aendereItem(gewaehltesItem.key, (item) => ({
                    ...item,
                    ...rechne({ startsAt: item.startsAt, endsAt: item.endsAt }),
                  }))
                }
              >
                {text}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <label className="text-sm font-medium text-slate-700">
              Person
              <select
                value={gewaehltesItem.assigneeId ?? ""}
                onChange={(ereignis) =>
                  aendereItem(gewaehltesItem.key, (item) => ({ ...item, assigneeId: ereignis.target.value || null }))
                }
                className="mt-1 block rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">– offen –</option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Pause (Min.)
              <input
                type="number"
                min={0}
                max={240}
                value={gewaehltesItem.pauseMinuten}
                onChange={(ereignis) =>
                  aendereItem(gewaehltesItem.key, (item) => ({
                    ...item,
                    pauseMinuten: Math.max(0, Math.min(240, Number(ereignis.target.value) || 0)),
                  }))
                }
                className="mt-1 block w-24 rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            {gewaehltesItem.liveId && gewaehlterBlock.status === "geaendert" ? (
              <button
                type="button"
                className={knopf}
                onClick={() => {
                  const echt = liveNachId.get(gewaehltesItem.liveId!);
                  if (echt) aendereItem(gewaehltesItem.key, (item) => ({ ...ausEchterSchicht(echt), key: item.key }));
                }}
              >
                Auf den Plan zurücksetzen
              </button>
            ) : null}
            <button
              type="button"
              className="text-sm font-semibold text-red-700 hover:underline"
              onClick={() => {
                setAuswahl(null);
                // Eine neue Schicht verschwindet; eine echte wird zum Entfernen vorgemerkt und lässt sich wiederherstellen.
                aendere((alt) =>
                  gewaehltesItem.liveId
                    ? alt.map((item) => (item.key === gewaehltesItem.key ? { ...item, geloescht: true } : item))
                    : alt.filter((item) => item.key !== gewaehltesItem.key),
                );
              }}
            >
              Schicht entfernen
            </button>
          </div>
        </div>
      ) : null}

      {gewaehlteEchte && !gewaehltesItem ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4">
          <div>
            <p className="font-semibold text-slate-900">{gewaehlteEchte.label}</p>
            <p className="text-sm text-slate-600">
              {uhrzeit(gewaehlteEchte.startsAt)}–{uhrzeit(gewaehlteEchte.endsAt)} Uhr ·{" "}
              {gewaehlteEchte.assignee ?? "offen"} · echter Plan, im Entwurf nicht enthalten
            </p>
          </div>
          <button
            type="button"
            className={knopf}
            onClick={() => {
              aendere((alt) => [...alt, ausEchterSchicht(gewaehlteEchte)]);
              setAuswahl(null);
            }}
          >
            In den Entwurf übernehmen
          </button>
        </div>
      ) : null}

      {entfernte.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-900">Aus dem Plan entfernt ({entfernte.length})</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            {entfernte.map((item) => (
              <li key={item.key} className="flex flex-wrap items-center gap-3">
                <span>
                  {item.label}, {tagKurz(lokalesDatum(new Date(item.startsAt)))} {uhrzeit(item.startsAt)}–
                  {uhrzeit(item.endsAt)} Uhr, {item.assigneeId ? (personName.get(item.assigneeId) ?? "?") : "offen"}
                </span>
                <button
                  type="button"
                  className="text-xs font-semibold text-brand-700 hover:underline"
                  onClick={() => aendereItem(item.key, (alt) => ({ ...alt, geloescht: false }))}
                >
                  Wiederherstellen
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {konflikte.length > 0 || befunde.length > 0 ? (
        <div className="space-y-2">
          {konflikte.map((konflikt) => (
            <p key={`${konflikt.a}${konflikt.b}`} className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-900">
              <strong>Überschneidung</strong> · {konflikt.text}
            </p>
          ))}
          {befunde.map((befund, index) => (
            <p
              key={`${befund.userId}${befund.datum}${index}`}
              className={`rounded-xl px-4 py-3 text-sm ${befund.schwere === "verstoss" ? "bg-rose-50 text-rose-900" : "bg-amber-50 text-amber-900"}`}
            >
              <strong>{befund.schwere === "verstoss" ? "Verstoß" : "Hinweis"}</strong> · {befund.name} ·{" "}
              {tagKurz(befund.datum)}
              <br />
              {befund.text}
            </p>
          ))}
          <p className="text-xs text-slate-500">
            Arbeitszeithinweise markieren nur - der Plan lässt sich trotzdem speichern. Überschneidungen derselben
            Person nicht.
          </p>
        </div>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------- Teilbereiche */

function SchichtHinzufuegen({
  tage,
  arten,
  onHinzu,
  onSchliessen,
}: {
  tage: string[];
  arten: SchichtartItem[];
  onHinzu: (liste: Omit<PlanEntwurfItem, "key" | "liveId" | "liveStand" | "geloescht">[]) => void;
  onSchliessen: () => void;
}) {
  const [artId, setArtId] = useState(arten[0]?.id ?? "");
  const [bezeichnung, setBezeichnung] = useState("");
  const [von, setVon] = useState("08:00");
  const [bis, setBis] = useState("15:00");
  const [pause, setPause] = useState(30);
  const art = arten.find((eintrag) => eintrag.id === artId);
  const [gewaehlt, setGewaehlt] = useState<number[]>(art?.tage ?? [1, 2, 3, 4, 5]);

  const wechsle = (id: string) => {
    setArtId(id);
    const neu = arten.find((eintrag) => eintrag.id === id);
    if (neu) setGewaehlt(neu.tage);
  };

  const hinzufuegen = () => {
    const vorlage = art ? { startZeit: art.startZeit, endZeit: art.endZeit } : { startZeit: von, endZeit: bis };
    const label = art ? art.name : bezeichnung.trim();
    if (label.length < 2) return;
    onHinzu(
      tage
        .filter((datum) => gewaehlt.includes(WOCHENTAGE.find((tag) => tag.kurz === wochentagKurz(datum))?.nummer ?? 0))
        .map((datum) => ({
          label,
          ...schichtartZeiten(vorlage, datum),
          pauseMinuten: art ? art.pauseMinuten : pause,
          assigneeId: null,
          schichtartId: art?.id ?? null,
          locationId: art?.locationId ?? null,
          departmentId: art?.departmentId ?? null,
          note: null,
        })),
    );
  };

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-end gap-4">
        <label className="text-sm font-medium text-slate-700">
          Schichtart
          <select
            value={artId}
            onChange={(ereignis) => wechsle(ereignis.target.value)}
            className="mt-1 block rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            {arten.map((eintrag) => (
              <option key={eintrag.id} value={eintrag.id}>
                {eintrag.name} ({eintrag.startZeit}–{eintrag.endZeit})
              </option>
            ))}
            <option value="">Eigene Schicht …</option>
          </select>
        </label>
        {!art ? (
          <>
            <label className="text-sm font-medium text-slate-700">
              Bezeichnung
              <input
                value={bezeichnung}
                onChange={(ereignis) => setBezeichnung(ereignis.target.value)}
                className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Von
              <input
                type="time"
                value={von}
                onChange={(ereignis) => setVon(ereignis.target.value)}
                className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Bis
              <input
                type="time"
                value={bis}
                onChange={(ereignis) => setBis(ereignis.target.value)}
                className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Pause (Min.)
              <input
                type="number"
                min={0}
                max={240}
                value={pause}
                onChange={(ereignis) => setPause(Number(ereignis.target.value) || 0)}
                className="mt-1 block w-24 rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
          </>
        ) : null}
      </div>
      <fieldset>
        <legend className="text-sm font-medium text-slate-700">An diesen Tagen</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {WOCHENTAGE.map((tag) => (
            <label
              key={tag.nummer}
              className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                checked={gewaehlt.includes(tag.nummer)}
                onChange={(ereignis) =>
                  setGewaehlt((alt) =>
                    ereignis.target.checked ? [...alt, tag.nummer] : alt.filter((nummer) => nummer !== tag.nummer),
                  )
                }
                className="h-4 w-4"
              />
              {tag.kurz}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={hinzufuegen}
          className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          Hinzufügen
        </button>
        <button type="button" onClick={onSchliessen} className="text-sm font-semibold text-slate-600 hover:underline">
          Schließen
        </button>
        <p className="text-xs text-slate-500">
          Die Schichten kommen offen in den Entwurf; teilen Sie sie danach ein oder lassen Sie automatisch befüllen.
        </p>
      </div>
    </div>
  );
}

function wochentagKurz(datum: string): string {
  return new Date(`${datum}T00:00:00Z`)
    .toLocaleDateString("de-DE", { weekday: "short", timeZone: "UTC" })
    .replace(".", "");
}

function Befuellen({
  arten,
  arbeitet,
  davor,
  luecken,
  ohneStunden,
  onBefuelle,
  onRueckgaengig,
}: {
  arten: SchichtartItem[];
  arbeitet: boolean;
  davor: boolean;
  luecken: PlanLuecke[];
  ohneStunden: string[];
  onBefuelle: (ids: string[]) => void;
  onRueckgaengig: () => void;
}) {
  const [gewaehlt, setGewaehlt] = useState<string[]>(arten.map((art) => art.id));
  const unterMindest = luecken.filter((luecke) => luecke.unterMindest);
  const unterIdeal = luecken.filter((luecke) => !luecke.unterMindest);

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
      <p className="text-sm text-slate-600">
        Besetzt die gewählten Schichtarten für diese Woche nach Zeitfenster, Arbeitstagen, Wochenstunden, Abwesenheit
        und Betriebskalender - <strong>nur im Entwurf</strong>, ohne den Plan anzufassen. Was die Planung nicht besetzen
        kann, kommt als offene Schicht. Das Ergebnis lässt sich rückgängig machen und von Hand weiter bearbeiten.
      </p>
      {arten.length === 0 ? (
        <p className="text-sm text-amber-800">
          Es gibt noch keine aktive Schichtart. Legen Sie zuerst unter „Schichtarten“ eine an.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {arten.map((art) => (
            <label
              key={art.id}
              className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                checked={gewaehlt.includes(art.id)}
                onChange={(ereignis) =>
                  setGewaehlt((alt) => (ereignis.target.checked ? [...alt, art.id] : alt.filter((id) => id !== art.id)))
                }
                className="h-4 w-4"
              />
              {art.name} <span className="text-xs text-slate-500">{art.bereich}</span>
            </label>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={arbeitet || gewaehlt.length === 0}
          onClick={() => onBefuelle(gewaehlt)}
          className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          {arbeitet ? "Berechnet …" : "Befüllen"}
        </button>
        {davor ? (
          <button type="button" onClick={onRueckgaengig} className={knopf}>
            Letzte Befüllung rückgängig
          </button>
        ) : null}
      </div>
      {unterMindest.length > 0 ? (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-900">
          <strong>{unterMindest.length} Schicht(en) bleiben unter der Mindestbesetzung:</strong>{" "}
          {unterMindest
            .map((luecke) => `${luecke.schichtart} ${tagKurz(luecke.datum)} (${luecke.besetzt}/${luecke.mindest})`)
            .join(", ")}
        </p>
      ) : null}
      {unterIdeal.length > 0 ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {unterIdeal.length} Schicht(en) unter der Idealbesetzung, aber über der Mindestbesetzung.
        </p>
      ) : null}
      {ohneStunden.length > 0 ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Ohne hinterlegte Wochenarbeitszeit (keine Obergrenze): {ohneStunden.join(", ")}.
        </p>
      ) : null}
    </div>
  );
}
