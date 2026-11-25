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
import { verschiebeSchichtAction } from "@/lib/actions";
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
 * auf Viertelstunden ein. Den Konflikt - dieselbe Person doppelt - entscheidet
 * der Server; der Block springt dann zurück und die Meldung steht darüber.
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
  const [zug, setZug] = useState<Zug | null>(null);
  const [auswahl, setAuswahl] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [, startTransition] = useTransition();
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

  // Die Schichten, wie sie gerade aussehen: die gezogene schon in ihrer Vorschauzeit.
  const angezeigt = useMemo(
    () =>
      schichten.map((schicht) =>
        zug && zug.id === schicht.id && zug.bewegt
          ? { ...schicht, ...vorschauZeiten({ startsAt: schicht.startsAt, endsAt: schicht.endsAt }, zug) }
          : schicht,
      ),
    [schichten, zug],
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

  const speichern = (id: string, neu: Zeiten) => {
    const alt = schichten.find((schicht) => schicht.id === id);
    if (!alt || (alt.startsAt === neu.startsAt && alt.endsAt === neu.endsAt)) return;
    setFehler(null);
    setSchichten((liste) => liste.map((schicht) => (schicht.id === id ? { ...schicht, ...neu } : schicht)));
    startTransition(async () => {
      const ergebnis = await verschiebeSchichtAction(id, neu.startsAt, neu.endsAt);
      if (!ergebnis.ok) {
        setSchichten((liste) =>
          liste.map((schicht) =>
            schicht.id === id ? { ...schicht, startsAt: alt.startsAt, endsAt: alt.endsAt } : schicht,
          ),
        );
        setFehler(ergebnis.message ?? "Die Änderung konnte nicht gespeichert werden.");
      }
    });
  };

  const beginneZug = (ereignis: React.PointerEvent<HTMLElement>, id: string, modus: Modus, tagIndex: number) => {
    if (!darfPflegen || ereignis.button !== 0) return;
    ereignis.stopPropagation();
    ereignis.currentTarget.setPointerCapture(ereignis.pointerId);
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

  const bewegeZug = (ereignis: React.PointerEvent<HTMLElement>) => {
    // Das Ereignis der Ziehkante steigt sonst in den Block auf und liefe dort ein zweites Mal.
    ereignis.stopPropagation();
    if (!zug) return;
    const breite = (spaltenRef.current?.getBoundingClientRect().width ?? 1) / tage.length;
    const dx = ereignis.clientX - zug.startX;
    const dy = ereignis.clientY - zug.startY;
    const bewegt = zug.bewegt || Math.abs(dx) > 4 || Math.abs(dy) > 4;
    const deltaTage =
      zug.modus === "bewegen"
        ? Math.max(-zug.tagIndex, Math.min(tage.length - 1 - zug.tagIndex, Math.round(dx / breite)))
        : 0;
    setZug({ ...zug, bewegt, deltaMinuten: runden(dy / PX), deltaTage });
  };

  const beendeZug = (ereignis: React.PointerEvent<HTMLElement>) => {
    // Sonst läuft das Loslassen an der Kante auch noch im Block und speichert doppelt -
    // der Server schickte der eingeteilten Person dann zwei Benachrichtigungen.
    ereignis.stopPropagation();
    if (!zug) return;
    const schicht = schichten.find((eintrag) => eintrag.id === zug.id);
    const aktuell = zug;
    setZug(null);
    if (!schicht) return;
    if (!aktuell.bewegt) {
      setAuswahl((alt) => (alt === schicht.id ? null : schicht.id));
      return;
    }
    speichern(schicht.id, vorschauZeiten({ startsAt: schicht.startsAt, endsAt: schicht.endsAt }, aktuell));
  };

  /** Pfeiltasten: ←/→ Tag, ↑/↓ eine Viertelstunde; mit Umschalt das Ende, mit Alt den Beginn. */
  const taste = (ereignis: React.KeyboardEvent<HTMLElement>, schicht: ShiftItem) => {
    if (!darfPflegen) return;
    const basis = { startsAt: schicht.startsAt, endsAt: schicht.endsAt };
    const schritt = ereignis.key === "ArrowUp" ? -15 : ereignis.key === "ArrowDown" ? 15 : 0;
    if (ereignis.key === "ArrowLeft" || ereignis.key === "ArrowRight") {
      ereignis.preventDefault();
      speichern(schicht.id, verschiebeSchicht(basis, ereignis.key === "ArrowLeft" ? -1 : 1, 0));
    } else if (schritt !== 0) {
      ereignis.preventDefault();
      speichern(
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

  const gewaehlt = auswahl ? schichten.find((schicht) => schicht.id === auswahl) : undefined;

  return (
    <div className="space-y-4">
      {fehler ? (
        <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {fehler}
        </p>
      ) : null}

      {darfPflegen ? (
        <p className="text-xs text-slate-500">
          Block ziehen verschiebt die Schicht, am oberen oder unteren Rand ziehen ändert Beginn oder Ende. Mit der
          Tastatur: Pfeile verschieben, Umschalt+↑/↓ ändert das Ende, Alt+↑/↓ den Beginn. Zeiten rasten auf
          Viertelstunden ein.
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
                            onPointerMove={bewegeZug}
                            onPointerUp={beendeZug}
                            onPointerCancel={() => setZug(null)}
                            className={`absolute overflow-hidden rounded-lg border px-1.5 py-1 text-[11px] leading-tight shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${farbe} ${
                              darfPflegen ? "cursor-grab touch-none select-none" : ""
                            } ${wirdGezogen ? "z-20 cursor-grabbing opacity-90 shadow-lg" : ""} ${
                              auswahl === schicht.id ? "ring-2 ring-brand-500" : ""
                            }`}
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
                                onPointerMove={bewegeZug}
                                onPointerUp={beendeZug}
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
                                onPointerMove={bewegeZug}
                                onPointerUp={beendeZug}
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
