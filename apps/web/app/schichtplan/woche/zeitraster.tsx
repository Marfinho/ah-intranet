"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  aendereBeginn,
  aendereEnde,
  lokaleUhrzeit,
  runden,
  schichtSegmente,
  ueberlappungsLayout,
  verschiebeSchicht,
  type Zeiten,
} from "@ah-intranet/shared";

/** Höhe einer Minute in Pixeln: 0,8 = 48 Pixel je Stunde, eine Viertelstunde sind 12. */
const PX = 0.8;

/** Schraffur für doppelt belegte Personen - hebt sich von „meine Schicht" in der Markenfarbe ab. */
const KONFLIKT_MUSTER = "repeating-linear-gradient(45deg, #fecdd3, #fecdd3 6px, #fff1f2 6px, #fff1f2 12px)";

export type BlockStatus =
  /** Echter Plan, im Entwurf nicht enthalten: wird nicht angefasst, bleibt aber sichtbar (ausgegraut). */
  "fest" | "unveraendert" | "neu" | "geaendert";

export interface Block {
  key: string;
  startsAt: string;
  endsAt: string;
  label: string;
  person: string | null;
  mine: boolean;
  status: BlockStatus;
  /** Nur Elemente im Entwurf lassen sich ziehen. */
  editierbar: boolean;
  marke?: "verstoss" | "hinweis";
  konflikt: boolean;
}

type Modus = "bewegen" | "beginn" | "ende";

interface Zug {
  key: string;
  modus: Modus;
  startX: number;
  startY: number;
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

/**
 * Telefon (unter 768 px): Sieben Spalten ergäben je 40 Pixel Breite - nichts wäre lesbar, und ein
 * Block ließe sich nicht treffen. Dort zeigt das Raster einen Tag.
 */
function useSchmal(): boolean {
  const [schmal, setSchmal] = useState(false);
  useEffect(() => {
    const abfrage = window.matchMedia("(max-width: 767px)");
    const lies = () => setSchmal(abfrage.matches);
    lies();
    abfrage.addEventListener("change", lies);
    return () => abfrage.removeEventListener("change", lies);
  }, []);
  return schmal;
}

function vorschauZeiten(basis: Zeiten, zug: Zug): Zeiten {
  if (zug.modus === "beginn") return aendereBeginn(basis, zug.deltaMinuten);
  if (zug.modus === "ende") return aendereEnde(basis, zug.deltaMinuten);
  return verschiebeSchicht(basis, zug.deltaTage, zug.deltaMinuten);
}

/**
 * Das Zeitraster der Wochenansicht: Tage als Spalten, Zeit senkrecht, überlappende Blöcke nebeneinander.
 *
 * Ziehen verschiebt, der obere und untere Rand ändern Beginn und Ende, mit der Tastatur gehen
 * Pfeile (Umschalt: Ende, Alt: Beginn). Die Komponente ändert **nichts** selbst - sie meldet die
 * neuen Zeiten über `onAendere`; ob das ein Entwurf oder sonst etwas ist, entscheidet der Aufrufer.
 *
 * Bewegung und Loslassen hängen am Fenster, nicht am Block: React baut den Block beim Wechsel der
 * Spalte neu auf, und eine Zeigererfassung am Element ginge verloren - ließe man dann in einer Lücke
 * los, klebte der Block am Zeiger.
 */
export function Zeitraster({
  tage: alleTage,
  heute,
  bloecke,
  freieTage,
  auswahl,
  onWaehle,
  onAendere,
}: {
  tage: string[];
  heute: string;
  bloecke: Block[];
  /** Tage mit Betriebskalender-Eintrag „arbeitsfrei": Datum → Name. */
  freieTage: Record<string, string>;
  auswahl: string | null;
  onWaehle: (key: string | null) => void;
  onAendere: (key: string, neu: Zeiten) => void;
}) {
  const schmal = useSchmal();
  const [gewaehlterTag, setGewaehlterTag] = useState<string | null>(null);
  // Standard: heute, wenn die Woche ihn enthält, sonst der erste Tag.
  const tagImFokus = alleTage.includes(gewaehlterTag ?? "")
    ? (gewaehlterTag as string)
    : alleTage.includes(heute)
      ? heute
      : alleTage[0];
  const tage = useMemo(() => (schmal ? [tagImFokus] : alleTage), [schmal, tagImFokus, alleTage]);
  /** Auf dem Telefon wird nicht gezogen (siehe unten), nur angetippt. */
  const ziehbar = (block: Block) => block.editierbar && !schmal;
  const [zug, setZugZustand] = useState<Zug | null>(null);
  const zugRef = useRef<Zug | null>(null);
  const spaltenRef = useRef<HTMLDivElement>(null);
  const setZug = (neu: Zug | null) => {
    zugRef.current = neu;
    setZugZustand(neu);
  };

  // Die Blöcke, wie sie gerade aussehen: der gezogene schon in seiner Vorschauzeit.
  const angezeigt = useMemo(
    () =>
      bloecke.map((block) =>
        zug && zug.key === block.key && zug.bewegt
          ? { ...block, ...vorschauZeiten({ startsAt: block.startsAt, endsAt: block.endsAt }, zug) }
          : block,
      ),
    [bloecke, zug],
  );

  const platziert = useMemo(
    () => ueberlappungsLayout(angezeigt.flatMap((block) => schichtSegmente({ id: block.key, ...block }, tage))),
    [angezeigt, tage],
  );
  const nachKey = useMemo(() => new Map(angezeigt.map((block) => [block.key, block])), [angezeigt]);

  // Sichtbarer Zeitbereich: mindestens 6 bis 20 Uhr, weiter, wenn ein Block darüber hinausreicht.
  const von = Math.min(360, ...platziert.map((p) => Math.floor(p.vonMin / 60) * 60));
  const bis = Math.max(1200, ...platziert.map((p) => Math.ceil(p.bisMin / 60) * 60));
  const stunden = Array.from({ length: (bis - von) / 60 + 1 }, (_, index) => von + index * 60);
  const hoehe = (bis - von) * PX;

  const beginneZug = (ereignis: React.PointerEvent<HTMLElement>, block: Block, modus: Modus, tagIndex: number) => {
    if (!ziehbar(block) || ereignis.button !== 0) return;
    ereignis.stopPropagation();
    setZug({
      key: block.key,
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
    const block = bloecke.find((eintrag) => eintrag.key === aktuell.key);
    setZug(null);
    if (!block) return;
    if (!aktuell.bewegt) {
      onWaehle(auswahl === block.key ? null : block.key);
      return;
    }
    onAendere(block.key, vorschauZeiten({ startsAt: block.startsAt, endsAt: block.endsAt }, aktuell));
  };

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
  const taste = (ereignis: React.KeyboardEvent<HTMLElement>, block: Block) => {
    const basis = { startsAt: block.startsAt, endsAt: block.endsAt };
    if (ereignis.key === "Enter" || ereignis.key === " ") {
      ereignis.preventDefault();
      onWaehle(auswahl === block.key ? null : block.key);
      return;
    }
    if (!block.editierbar) return;
    const schritt = ereignis.key === "ArrowUp" ? -15 : ereignis.key === "ArrowDown" ? 15 : 0;
    if (ereignis.key === "ArrowLeft" || ereignis.key === "ArrowRight") {
      ereignis.preventDefault();
      onAendere(block.key, verschiebeSchicht(basis, ereignis.key === "ArrowLeft" ? -1 : 1, 0));
    } else if (schritt !== 0) {
      ereignis.preventDefault();
      onAendere(
        block.key,
        ereignis.shiftKey
          ? aendereEnde(basis, schritt)
          : ereignis.altKey
            ? aendereBeginn(basis, schritt)
            : verschiebeSchicht(basis, 0, schritt),
      );
    }
  };

  return (
    <div className="space-y-3">
      {schmal ? (
        <div role="tablist" aria-label="Tag wählen" className="grid grid-cols-7 gap-1">
          {alleTage.map((datum) => {
            const aktiv = datum === tagImFokus;
            const belegt = bloecke.some(
              (block) => schichtSegmente({ id: block.key, ...block }, [datum]).length > 0,
            );
            return (
              <button
                key={datum}
                type="button"
                role="tab"
                aria-selected={aktiv}
                onClick={() => setGewaehlterTag(datum)}
                className={`klein flex min-h-[52px] flex-col items-center justify-center rounded-xl border px-0.5 py-1 text-[11px] leading-tight ${
                  aktiv
                    ? "border-brand-600 bg-brand-600 text-white"
                    : datum === heute
                      ? "border-brand-400 bg-brand-50 text-brand-800"
                      : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                <span className="font-semibold">{wochentagKurz(datum).replace(".", "")}</span>
                <span className="tabular-nums">{tagZahl(datum).slice(0, 2)}.</span>
                <span className={`mt-0.5 h-1 w-1 rounded-full ${belegt ? (aktiv ? "bg-white" : "bg-brand-600") : "bg-transparent"}`} />
              </button>
            );
          })}
        </div>
      ) : null}
      <div className="overflow-x-auto pb-3">
        <div className={schmal ? "" : "min-w-[760px]"}>
          <div className="grid" style={{ gridTemplateColumns: `3rem repeat(${tage.length}, minmax(0, 1fr))` }}>
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

          <div className="grid" style={{ gridTemplateColumns: `3rem repeat(${tage.length}, minmax(0, 1fr))` }}>
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

            <div ref={spaltenRef} className="relative grid" style={{ height: hoehe, gridColumn: "2 / -1", gridTemplateColumns: `repeat(${tage.length}, minmax(0, 1fr))` }}>
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
                        const block = nachKey.get(eintrag.schichtId)!;
                        const wirdGezogen = zug?.key === block.key && zug.bewegt;
                        const dauer = eintrag.bisMin - eintrag.vonMin;
                        const schmal = eintrag.spalten > 1;
                        const von0 = lokaleUhrzeit(new Date(block.startsAt));
                        const bis0 = lokaleUhrzeit(new Date(block.endsAt));
                        const farbe = block.konflikt
                          ? "border-2 border-rose-600 text-rose-950"
                          : block.status === "fest"
                            ? "border-slate-300 bg-slate-50 text-slate-500 opacity-70"
                            : !block.person
                              ? "border-amber-400 bg-amber-100 text-amber-950"
                              : block.mine
                                ? "border-brand-400 bg-brand-100 text-brand-950"
                                : "border-slate-300 bg-slate-100 text-slate-900";
                        return (
                          <div
                            key={`${block.key}${datum}`}
                            role="button"
                            tabIndex={0}
                            title={`${block.label}, ${von0}–${bis0} Uhr, ${block.person ?? "offen"}${block.konflikt ? " - Person doppelt belegt" : ""}${block.status === "fest" ? " (echter Plan, nicht im Entwurf)" : ""}`}
                            aria-label={`${block.label}, ${von0} bis ${bis0} Uhr, ${block.person ?? "offen"}`}
                            aria-pressed={auswahl === block.key}
                            onKeyDown={(ereignis) => taste(ereignis, block)}
                            onPointerDown={(ereignis) => beginneZug(ereignis, block, "bewegen", tagIndex)}
                            onClick={ziehbar(block) ? undefined : () => onWaehle(auswahl === block.key ? null : block.key)}
                            className={`absolute overflow-hidden rounded-lg border px-1.5 py-1 text-[11px] leading-tight shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${farbe} ${
                              ziehbar(block) ? "cursor-grab touch-none select-none" : ""
                            } ${wirdGezogen ? "z-20 cursor-grabbing opacity-90 shadow-lg" : ""} ${
                              auswahl === block.key ? "ring-2 ring-brand-500" : ""
                            } ${block.status === "neu" || block.status === "geaendert" ? "border-dashed" : ""}`}
                            style={{
                              ...(block.konflikt ? { backgroundImage: KONFLIKT_MUSTER } : {}),
                              top: (eintrag.vonMin - von) * PX,
                              height: Math.max(dauer * PX - 1, 14),
                              left: `calc(${(eintrag.spalte / eintrag.spalten) * 100}% + 1px)`,
                              width: `calc(${100 / eintrag.spalten}% - 3px)`,
                            }}
                          >
                            {ziehbar(block) && eintrag.beginntHier ? (
                              <span
                                aria-hidden
                                onPointerDown={(ereignis) => beginneZug(ereignis, block, "beginn", tagIndex)}
                                className="absolute inset-x-0 top-0 h-2 cursor-ns-resize"
                              />
                            ) : null}
                            <p className="truncate font-semibold">
                              {!eintrag.beginntHier ? "↳ " : ""}
                              {schmal ? (block.person ?? "Offen") : block.label}
                              {!eintrag.endetHier ? " →" : ""}
                              {block.marke ? (
                                <span
                                  title={
                                    block.marke === "verstoss"
                                      ? "Verstoß gegen das Arbeitszeitgesetz"
                                      : "Hinweis zum Arbeitszeitgesetz"
                                  }
                                  className={`ml-1 ${block.marke === "verstoss" ? "text-rose-700" : "text-amber-700"}`}
                                >
                                  ⚠
                                </span>
                              ) : null}
                            </p>
                            {dauer * PX >= 30 ? (
                              <p className="truncate tabular-nums">
                                {von0}
                                {schmal ? "" : `–${bis0}`}
                              </p>
                            ) : null}
                            {dauer * PX >= 44 && !schmal ? <p className="truncate">{block.person ?? "Offen"}</p> : null}
                            {block.konflikt && dauer * PX >= 58 ? (
                              <p className="font-semibold">doppelt belegt</p>
                            ) : null}
                            {ziehbar(block) && eintrag.endetHier ? (
                              <span
                                aria-hidden
                                onPointerDown={(ereignis) => beginneZug(ereignis, block, "ende", tagIndex)}
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
          <span className="inline-block h-3 w-3 rounded-sm border-2 border-dashed border-slate-500" /> neu oder geändert
          im Entwurf
        </li>
        <li className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-sm border border-slate-300 bg-slate-50 opacity-70" /> echter
          Plan, nicht im Entwurf
        </li>
        <li>⚠ Hinweis zum Arbeitszeitgesetz</li>
      </ul>
    </div>
  );
}
