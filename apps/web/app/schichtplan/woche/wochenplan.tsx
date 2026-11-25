"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  aendereBeginn,
  aendereEnde,
  lokaleUhrzeit,
  runden,
  schichtSegmente,
  ueberlappungsLayout,
  verschiebeSchicht,
  type ShiftItem,
  type Zeiten,
} from "@ah-intranet/shared";
import { speichereZeitenAction } from "@/lib/actions";
import { Einteilen } from "../einteilen";

/** Schraffur für doppelt belegte Personen - hebt sich von „meine Schicht" in der Markenfarbe ab. */
const KONFLIKT_MUSTER = "repeating-linear-gradient(45deg, #fecdd3, #fecdd3 6px, #fff1f2 6px, #fff1f2 12px)";

/** Höhe einer Minute in Pixeln: 0,8 = 48 Pixel je Stunde, eine Viertelstunde sind 12. */
const PX = 0.8;

export interface Hinweis {
  userId: string;
  datum: string;
  schwere: "verstoss" | "hinweis";
}

type Modus = "bewegen" | "beginn" | "ende";

interface Zug {
  id: string;
  modus: Modus;
  startX: number;
  startY: number;
  /** Segmentindex des Tages, auf dem der Zug begann - begrenzt das Ziehen auf die gezeigte Woche. */
  tagIndex: number;
  deltaMinuten: number;
  deltaTage: number;
  bewegt: boolean;
}

function wochentagKurz(datum: string): string {
  return new Date(`${datum}T00:00:00Z`).toLocaleDateString("de-DE", { weekday: "short", timeZone: "UTC" });
}

function tagZahl(datum: string): string {
  return new Date(`${datum}T00:00:00Z`).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
}

/** Zeiten, die der laufende Zug ergäbe - Grundlage der Vorschau noch vor dem Loslassen. */
function vorschauZeiten(basis: Zeiten, zug: Zug): Zeiten {
  if (zug.modus === "beginn") return aendereBeginn(basis, zug.deltaMinuten);
  if (zug.modus === "ende") return aendereEnde(basis, zug.deltaMinuten);
  return verschiebeSchicht(basis, zug.deltaTage, zug.deltaMinuten);
}

/**
 * Wochenansicht des Schichtplans.
 *
 * Überlappende Schichten stehen nebeneinander statt übereinander. Wer den Plan
 * pflegen darf, zieht Blöcke auf einen anderen Tag oder eine andere Uhrzeit und
 * zieht am oberen oder unteren Rand, um Beginn oder Ende zu ändern; mit der
 * Tastatur gehen dieselben Änderungen über die Pfeiltasten. Die Zeiten rasten
 * auf Viertelstunden ein.
 *
 * Alles Gezogene ist ein **Entwurf**: es bleibt im Browser, bis jemand
 * „Speichern" klickt. Erst dann wird gespeichert und werden die betroffenen
 * Personen benachrichtigt - eine Meldung je Person. Wer beim Umplanen für jeden
 * Zug eine Mail auslöste, bekäme die Belegschaft als Flut zu spüren. Den Konflikt
 * - dieselbe Person doppelt - entscheidet beim Speichern der Server, der den
 * Endzustand des ganzen Entwurfs prüft; bis dahin zeigt der Plan ihn schraffiert.
 */
export function Wochenplan({
  tage,
  heute,
  schichten: eingang,
  darfPflegen,
  freieTage,
  hinweise,
  people,
}: {
  tage: string[];
  heute: string;
  schichten: ShiftItem[];
  darfPflegen: boolean;
  /** Tage mit Betriebskalender-Eintrag „arbeitsfrei": Datum → Name. */
  freieTage: Record<string, string>;
  hinweise: Hinweis[];
  people: { id: string; name: string }[];
}) {
  const [schichten, setSchichten] = useState(eingang);
  /** Ungespeicherte Änderungen: Schicht-ID → neue Zeiten. */
  const [entwurf, setEntwurf] = useState<Record<string, Zeiten>>({});
  const [meldung, setMeldung] = useState<string | null>(null);
  const [speichert, startSpeichern] = useTransition();
  const [zug, setZugZustand] = useState<Zug | null>(null);
  // Der laufende Zug zusätzlich als Ref: Bewegung und Loslassen werden am Fenster abgehört und
  // müssen immer den neuesten Stand sehen, nicht den der Render-Runde, in der sie angemeldet wurden.
  const zugRef = useRef<Zug | null>(null);
  const setZug = (neu: Zug | null) => {
    zugRef.current = neu;
    setZugZustand(neu);
  };
  const [auswahl, setAuswahl] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const spaltenRef = useRef<HTMLDivElement>(null);

  // Nach einer Aktualisierung vom Server gilt wieder der Stand der Datenbank.
  useEffect(() => setSchichten(eingang), [eingang]);

  const hinweisNach = useMemo(() => {
    const karte = new Map<string, "verstoss" | "hinweis">();
    for (const eintrag of hinweise) {
      const schluessel = `${eintrag.userId}|${eintrag.datum}`;
      if (karte.get(schluessel) !== "verstoss") karte.set(schluessel, eintrag.schwere);
    }
    return karte;
  }, [hinweise]);

  /** Zeiten einer Schicht, wie sie jetzt gelten: der Entwurf vor dem gespeicherten Stand. */
  const aktuelleZeiten = (schicht: ShiftItem): Zeiten =>
    entwurf[schicht.id] ?? { startsAt: schicht.startsAt, endsAt: schicht.endsAt };

  // Die Schichten, wie sie gerade aussehen: Entwurf eingerechnet, die gezogene in ihrer Vorschauzeit.
  const angezeigt = useMemo(
    () =>
      schichten.map((schicht) => {
        const basis = entwurf[schicht.id] ?? { startsAt: schicht.startsAt, endsAt: schicht.endsAt };
        return zug && zug.id === schicht.id && zug.bewegt
          ? { ...schicht, ...vorschauZeiten(basis, zug) }
          : { ...schicht, ...basis };
      }),
    [schichten, entwurf, zug],
  );

  const platziert = useMemo(
    () => ueberlappungsLayout(angezeigt.flatMap((schicht) => schichtSegmente(schicht, tage))),
    [angezeigt, tage],
  );

  // Sichtbarer Zeitbereich: mindestens 6 bis 20 Uhr, weiter, wenn eine Schicht darüber hinausreicht.
  const von = Math.min(360, ...platziert.map((p) => Math.floor(p.vonMin / 60) * 60));
  const bis = Math.max(1200, ...platziert.map((p) => Math.ceil(p.bisMin / 60) * 60));
  const stunden = Array.from({ length: (bis - von) / 60 + 1 }, (_, index) => von + index * 60);
  const hoehe = (bis - von) * PX;

  const nachId = useMemo(() => new Map(angezeigt.map((schicht) => [schicht.id, schicht])), [angezeigt]);

  /** Überschneidet die Schicht eine andere derselben Person? Das lehnt der Server ab - hier schon rot. */
  const konflikt = (id: string): boolean => {
    const schicht = nachId.get(id);
    if (!schicht?.assigneeId) return false;
    return angezeigt.some(
      (andere) =>
        andere.id !== id &&
        andere.assigneeId === schicht.assigneeId &&
        andere.startsAt < schicht.endsAt &&
        andere.endsAt > schicht.startsAt,
    );
  };

  /** Merkt eine Änderung vor. Landet eine Schicht wieder bei ihren gespeicherten Zeiten, ist sie keine Änderung mehr. */
  const vormerken = (id: string, neu: Zeiten) => {
    const gespeichert = schichten.find((schicht) => schicht.id === id);
    if (!gespeichert) return;
    setMeldung(null);
    setFehler(null);
    setEntwurf((alt) => {
      const naechster = { ...alt };
      if (gespeichert.startsAt === neu.startsAt && gespeichert.endsAt === neu.endsAt) {
        delete naechster[id];
      } else {
        naechster[id] = neu;
      }
      return naechster;
    });
  };

  const aenderungen = Object.keys(entwurf).length;
  const konfliktIds = Object.keys(entwurf).filter((id) => konflikt(id));

  const verwerfen = () => {
    setEntwurf({});
    setFehler(null);
    setMeldung(null);
  };

  const speichernKlick = () => {
    const liste = Object.entries(entwurf).map(([id, zeiten]) => ({ id, ...zeiten }));
    if (liste.length === 0) return;
    setFehler(null);
    startSpeichern(async () => {
      const ergebnis = await speichereZeitenAction(liste);
      if (!ergebnis.ok) {
        // Der Entwurf bleibt stehen: wer eine Überschneidung hat, korrigiert sie, statt von vorn anzufangen.
        setFehler(ergebnis.message ?? "Die Änderungen konnten nicht gespeichert werden.");
        return;
      }
      setSchichten((alt) =>
        alt.map((schicht) => (entwurf[schicht.id] ? { ...schicht, ...entwurf[schicht.id] } : schicht)),
      );
      setEntwurf({});
      setMeldung(
        `${liste.length} Änderung(en) gespeichert${
          ergebnis.benachrichtigt
            ? ` - ${ergebnis.benachrichtigt} Person(en) benachrichtigt`
            : " - niemand zu benachrichtigen"
        }.`,
      );
    });
  };

  // Ungespeichertes nicht stillschweigend verlieren: beim Schließen/Neuladen und beim Klick auf einen Link.
  useEffect(() => {
    if (aenderungen === 0) return;
    const vorVerlassen = (ereignis: BeforeUnloadEvent) => {
      ereignis.preventDefault();
    };
    const vorLink = (ereignis: MouseEvent) => {
      const link = (ereignis.target as HTMLElement | null)?.closest("a[href]");
      if (link && !window.confirm("Es gibt ungespeicherte Änderungen. Wirklich verlassen und verwerfen?")) {
        ereignis.preventDefault();
        ereignis.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", vorVerlassen);
    document.addEventListener("click", vorLink, true);
    return () => {
      window.removeEventListener("beforeunload", vorVerlassen);
      document.removeEventListener("click", vorLink, true);
    };
  }, [aenderungen]);

  const beginneZug = (ereignis: React.PointerEvent<HTMLElement>, id: string, modus: Modus, tagIndex: number) => {
    if (!darfPflegen || ereignis.button !== 0) return;
    ereignis.stopPropagation();
    setZug({
      id,
      modus,
      startX: ereignis.clientX,
      startY: ereignis.clientY,
      tagIndex,
      deltaMinuten: 0,
      deltaTage: 0,
      bewegt: false,
    });
  };

  const bewegeZug = (clientX: number, clientY: number) => {
    const aktuell = zugRef.current;
    if (!aktuell) return;
    const breite = (spaltenRef.current?.getBoundingClientRect().width ?? 1) / tage.length;
    const dx = clientX - aktuell.startX;
    const dy = clientY - aktuell.startY;
    const bewegt = aktuell.bewegt || Math.abs(dx) > 4 || Math.abs(dy) > 4;
    const deltaTage =
      aktuell.modus === "bewegen"
        ? Math.max(-aktuell.tagIndex, Math.min(tage.length - 1 - aktuell.tagIndex, Math.round(dx / breite)))
        : 0;
    setZug({ ...aktuell, bewegt, deltaMinuten: runden(dy / PX), deltaTage });
  };

  const beendeZug = () => {
    const aktuell = zugRef.current;
    if (!aktuell) return;
    const schicht = schichten.find((eintrag) => eintrag.id === aktuell.id);
    setZug(null);
    if (!schicht) return;
    if (!aktuell.bewegt) {
      setAuswahl((alt) => (alt === schicht.id ? null : schicht.id));
      return;
    }
    vormerken(schicht.id, vorschauZeiten(aktuelleZeiten(schicht), aktuell));
  };

  // Am Fenster statt am Block: beim Ziehen in eine andere Spalte baut React das Element neu auf, und eine
  // Zeigererfassung am Block ginge verloren - ließe man dann in einer Lücke los, klebte der Block am Zeiger.
  const handlerRef = useRef({ bewegeZug, beendeZug });
  handlerRef.current = { bewegeZug, beendeZug };
  useEffect(() => {
    const bewegen = (ereignis: PointerEvent) => handlerRef.current.bewegeZug(ereignis.clientX, ereignis.clientY);
    const loslassen = () => handlerRef.current.beendeZug();
    const abbrechen = () => setZug(null);
    window.addEventListener("pointermove", bewegen);
    window.addEventListener("pointerup", loslassen);
    window.addEventListener("pointercancel", abbrechen);
    return () => {
      window.removeEventListener("pointermove", bewegen);
      window.removeEventListener("pointerup", loslassen);
      window.removeEventListener("pointercancel", abbrechen);
    };
  }, []);

  /** Pfeiltasten: ←/→ Tag, ↑/↓ eine Viertelstunde; mit Umschalt das Ende, mit Alt den Beginn. */
  const taste = (ereignis: React.KeyboardEvent<HTMLElement>, schicht: ShiftItem) => {
    if (!darfPflegen) return;
    const basis = aktuelleZeiten(schicht);
    const schritt = ereignis.key === "ArrowUp" ? -15 : ereignis.key === "ArrowDown" ? 15 : 0;
    if (ereignis.key === "ArrowLeft" || ereignis.key === "ArrowRight") {
      ereignis.preventDefault();
      vormerken(schicht.id, verschiebeSchicht(basis, ereignis.key === "ArrowLeft" ? -1 : 1, 0));
    } else if (schritt !== 0) {
      ereignis.preventDefault();
      vormerken(
        schicht.id,
        ereignis.shiftKey
          ? aendereEnde(basis, schritt)
          : ereignis.altKey
            ? aendereBeginn(basis, schritt)
            : verschiebeSchicht(basis, 0, schritt),
      );
    } else if (ereignis.key === "Enter" || ereignis.key === " ") {
      ereignis.preventDefault();
      setAuswahl((alt) => (alt === schicht.id ? null : schicht.id));
    }
  };

  const gewaehlt = auswahl ? angezeigt.find((schicht) => schicht.id === auswahl) : undefined;

  return (
    <div className="space-y-4">
      {fehler ? (
        <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {fehler}
        </p>
      ) : null}

      {meldung ? (
        <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {meldung}
        </p>
      ) : null}

      {aenderungen > 0 ? (
        <div className="sticky top-2 z-30 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-300 bg-white px-4 py-3 shadow-lg">
          <div className="text-sm">
            <p className="font-semibold text-slate-900">{aenderungen} ungespeicherte Änderung(en)</p>
            <p className="text-xs text-slate-500">
              Niemand wird benachrichtigt, bevor Sie speichern. Danach bekommt jede betroffene Person eine Meldung.
            </p>
            {konfliktIds.length > 0 ? (
              <p className="mt-1 text-xs font-semibold text-rose-700">
                {konfliktIds.length} Schicht(en) überschneiden sich mit einer anderen derselben Person (schraffiert).
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={verwerfen}
              disabled={speichert}
              className="text-sm font-semibold text-slate-600 hover:underline disabled:opacity-40"
            >
              Verwerfen
            </button>
            <button
              type="button"
              onClick={speichernKlick}
              disabled={speichert || konfliktIds.length > 0}
              className="rounded-xl bg-brand-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
            >
              {speichert ? "Speichert …" : "Speichern"}
            </button>
          </div>
        </div>
      ) : null}

      {darfPflegen ? (
        <p className="text-xs text-slate-500">
          Block ziehen verschiebt die Schicht, am oberen oder unteren Rand ziehen ändert Beginn oder Ende. Mit der
          Tastatur: Pfeile verschieben, Umschalt+↑/↓ ändert das Ende, Alt+↑/↓ den Beginn. Zeiten rasten auf
          Viertelstunden ein. Gespeichert und gemeldet wird erst mit „Speichern".
        </p>
      ) : null}

      <div className="overflow-x-auto pb-3">
        <div className="min-w-[760px]">
          <div className="grid" style={{ gridTemplateColumns: "3rem repeat(7, minmax(0, 1fr))" }}>
            <div />
            {tage.map((datum) => (
              <div
                key={datum}
                title={freieTage[datum]}
                className={`border-b border-slate-200 px-2 py-2 text-center text-xs ${
                  datum === heute ? "font-bold text-brand-700" : "font-semibold text-slate-600"
                }`}
              >
                {wochentagKurz(datum)} {tagZahl(datum)}
                {freieTage[datum] ? (
                  <span className="block truncate font-normal text-slate-400">{freieTage[datum]}</span>
                ) : null}
              </div>
            ))}
          </div>

          <div className="grid" style={{ gridTemplateColumns: "3rem repeat(7, minmax(0, 1fr))" }}>
            <div className="relative" style={{ height: hoehe }}>
              {stunden.map((minute) => (
                <span
                  key={minute}
                  className="absolute right-1 -translate-y-1/2 text-[10px] tabular-nums text-slate-400"
                  style={{ top: (minute - von) * PX }}
                >
                  {String(minute / 60).padStart(2, "0")}:00
                </span>
              ))}
            </div>

            <div ref={spaltenRef} className="relative col-span-7 grid grid-cols-7" style={{ height: hoehe }}>
              {tage.map((datum, tagIndex) => {
                const wochentag = new Date(`${datum}T00:00:00Z`).getUTCDay();
                const frei = wochentag === 0 || wochentag === 6 || Boolean(freieTage[datum]);
                return (
                  <div
                    key={datum}
                    className={`relative border-l border-slate-200 ${frei ? "bg-slate-50" : ""}`}
                    style={{
                      backgroundImage: "linear-gradient(to bottom, rgb(226 232 240 / 0.7) 1px, transparent 1px)",
                      backgroundSize: `100% ${60 * PX}px`,
                    }}
                  >
                    {platziert
                      .filter((eintrag) => eintrag.datum === datum)
                      .map((eintrag) => {
                        const schicht = nachId.get(eintrag.schichtId)!;
                        const wirdGezogen = zug?.id === schicht.id && zug.bewegt;
                        const istEntwurf = Boolean(entwurf[schicht.id]);
                        const rot = konflikt(schicht.id);
                        const marke = schicht.assigneeId
                          ? hinweisNach.get(`${schicht.assigneeId}|${datum}`)
                          : undefined;
                        const dauer = eintrag.bisMin - eintrag.vonMin;
                        const schmal = eintrag.spalten > 1;
                        const farbe = rot
                          ? "border-2 border-rose-600 text-rose-950"
                          : !schicht.assignee
                            ? "border-amber-400 bg-amber-100 text-amber-950"
                            : schicht.mine
                              ? "border-brand-400 bg-brand-100 text-brand-950"
                              : "border-slate-300 bg-slate-100 text-slate-900";
                        return (
                          <div
                            key={`${schicht.id}${datum}`}
                            role="button"
                            tabIndex={0}
                            title={`${schicht.label}, ${lokaleUhrzeit(new Date(schicht.startsAt))}–${lokaleUhrzeit(new Date(schicht.endsAt))} Uhr, ${schicht.assignee ?? "offen"}${rot ? " - Person doppelt belegt" : ""}`}
                            aria-label={`${schicht.label}, ${lokaleUhrzeit(new Date(schicht.startsAt))} bis ${lokaleUhrzeit(new Date(schicht.endsAt))} Uhr, ${schicht.assignee ?? "offen"}`}
                            aria-pressed={auswahl === schicht.id}
                            onKeyDown={(ereignis) => taste(ereignis, schicht)}
                            onPointerDown={(ereignis) => beginneZug(ereignis, schicht.id, "bewegen", tagIndex)}
                            className={`absolute overflow-hidden rounded-lg border px-1.5 py-1 text-[11px] leading-tight shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${farbe} ${
                              darfPflegen ? "cursor-grab touch-none select-none" : ""
                            } ${wirdGezogen ? "z-20 cursor-grabbing opacity-90 shadow-lg" : ""} ${
                              auswahl === schicht.id ? "ring-2 ring-brand-500" : ""
                            } ${istEntwurf ? "border-dashed" : ""}`}
                            style={{
                              ...(rot ? { backgroundImage: KONFLIKT_MUSTER } : {}),
                              top: (eintrag.vonMin - von) * PX,
                              height: Math.max(dauer * PX - 1, 14),
                              left: `calc(${(eintrag.spalte / eintrag.spalten) * 100}% + 1px)`,
                              width: `calc(${100 / eintrag.spalten}% - 3px)`,
                            }}
                          >
                            {darfPflegen && eintrag.beginntHier ? (
                              <span
                                aria-hidden
                                onPointerDown={(ereignis) => beginneZug(ereignis, schicht.id, "beginn", tagIndex)}
                                className="absolute inset-x-0 top-0 h-2 cursor-ns-resize"
                              />
                            ) : null}
                            <p className="truncate font-semibold">
                              {!eintrag.beginntHier ? "↳ " : ""}
                              {schmal ? (schicht.assignee ?? "Offen") : schicht.label}
                              {!eintrag.endetHier ? " →" : ""}
                              {marke ? (
                                <span
                                  title={
                                    marke === "verstoss"
                                      ? "Verstoß gegen das Arbeitszeitgesetz"
                                      : "Hinweis zum Arbeitszeitgesetz"
                                  }
                                  className={`ml-1 ${marke === "verstoss" ? "text-rose-700" : "text-amber-700"}`}
                                >
                                  ⚠
                                </span>
                              ) : null}
                            </p>
                            {dauer * PX >= 30 ? (
                              <p className="truncate tabular-nums">
                                {lokaleUhrzeit(new Date(schicht.startsAt))}
                                {schmal ? "" : `–${lokaleUhrzeit(new Date(schicht.endsAt))}`}
                              </p>
                            ) : null}
                            {dauer * PX >= 44 && !schmal ? (
                              <p className="truncate">{schicht.assignee ?? "Offen"}</p>
                            ) : null}
                            {rot && dauer * PX >= 58 ? <p className="font-semibold">doppelt belegt</p> : null}
                            {darfPflegen && eintrag.endetHier ? (
                              <span
                                aria-hidden
                                onPointerDown={(ereignis) => beginneZug(ereignis, schicht.id, "ende", tagIndex)}
                                className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
                              />
                            ) : null}
                          </div>
                        );
                      })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <ul className="flex flex-wrap gap-4 text-xs text-slate-600">
        <li className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-sm border border-brand-400 bg-brand-100" /> meine Schicht
        </li>
        <li className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-sm border border-slate-300 bg-slate-100" /> eingeteilt
        </li>
        <li className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-sm border border-amber-400 bg-amber-100" /> offen
        </li>
        <li className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-sm border-2 border-rose-600"
            style={{ backgroundImage: KONFLIKT_MUSTER }}
          />{" "}
          Person doppelt belegt
        </li>
        <li className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-sm border-2 border-dashed border-slate-500" /> ungespeichert
        </li>
        <li>⚠ Hinweis zum Arbeitszeitgesetz · Überlappende Schichten stehen nebeneinander</li>
      </ul>

      {gewaehlt ? (
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="font-semibold text-slate-900">{gewaehlt.label}</p>
          <p className="mt-1 text-sm text-slate-600">
            {tagZahl(gewaehlt.startsAt.slice(0, 10))} · {lokaleUhrzeit(new Date(gewaehlt.startsAt))}–
            {lokaleUhrzeit(new Date(gewaehlt.endsAt))} Uhr
            {gewaehlt.location ? ` · ${gewaehlt.location}` : ""}
            {gewaehlt.department ? ` · ${gewaehlt.department}` : ""}
          </p>
          <p className="mt-1 text-sm text-slate-600">{gewaehlt.assignee ?? "Offen"}</p>
          {gewaehlt.note ? <p className="mt-1 text-sm text-slate-500">{gewaehlt.note}</p> : null}
          {darfPflegen ? (
            <div className="mt-3">
              <Einteilen shiftId={gewaehlt.id} assigneeId={gewaehlt.assigneeId ?? null} people={people} />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
