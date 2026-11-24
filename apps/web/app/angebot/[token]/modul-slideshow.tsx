"use client";

import { useEffect, useRef, useState } from "react";
import {
  SZENE_BREITE,
  SZENE_HOEHE,
  getModule,
  szeneFuer,
  type FigurArt,
  type Szene,
  type SzenenAbzeichen,
  type SzenenZustand,
} from "@ah-intranet/shared";

/**
 * Slideshow zu einem Modul: eine kleine Choreografie, die zeigt, was es tut.
 *
 * Die Szenen sind Daten (`packages/shared/src/pitch-szenen.ts`). Hier wird nur
 * gezeichnet: jede Figur sitzt an einer Position, und CSS übernimmt die Bewegung
 * zwischen den Schritten.
 */

type Stand = Required<Omit<SzenenZustand, "werte">> & { werte: number[] };

function standNach(szene: Szene, nummer: number): Record<string, Stand> {
  const stand: Record<string, Stand> = {};
  for (const figur of szene.figuren) {
    stand[figur.id] = {
      x: 0,
      y: 0,
      sichtbar: true,
      gedimmt: false,
      rand: null,
      abzeichen: null,
      label: figur.label ?? "",
      werte: [],
    };
  }
  for (let i = 0; i <= nummer; i += 1) {
    for (const [id, teil] of Object.entries(szene.schritte[i].zustand)) {
      stand[id] = { ...stand[id], ...teil } as Stand;
    }
  }
  return stand;
}

function Koerper({ art, label, werte }: { art: FigurArt; label?: string; werte: number[] }) {
  const beschriftung = (y: number) =>
    label ? (
      <text className="b-label" y={y} textAnchor="middle">
        {label}
      </text>
    ) : null;
  switch (art) {
    case "person":
      return (
        <>
          <circle className="korpus fuell-person" cx="0" cy="-22" r="14" />
          <path className="korpus fuell-person" d="M-26 22 C-26 -2 26 -2 26 22 Z" />
          {beschriftung(44)}
        </>
      );
    case "haus":
      return (
        <>
          <rect className="korpus fuell-haus" x="-34" y="-44" width="68" height="88" rx="3" />
          <rect className="fuell-dach" x="-39" y="-52" width="78" height="8" rx="2" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect
              key={i}
              className="fuell-fenster"
              x={-24 + (i % 3) * 18}
              y={-32 + Math.floor(i / 3) * 24}
              width="12"
              height="14"
              rx="1"
            />
          ))}
          {beschriftung(64)}
        </>
      );
    case "dokument":
      return (
        <>
          <rect className="korpus fuell-doc" x="-22" y="-30" width="44" height="60" rx="4" />
          {[-16, -6, 4, 14].map((y) => (
            <line key={y} className="doc-linie" x1="-13" x2="13" y1={y} y2={y} />
          ))}
          {beschriftung(50)}
        </>
      );
    case "kasten":
      return (
        <>
          <rect className="korpus fuell-kasten" x="-62" y="-48" width="124" height="96" rx="6" />
          {beschriftung(70)}
        </>
      );
    case "schicht":
      return (
        <>
          <rect className="korpus fuell-schicht" x="-48" y="-20" width="96" height="40" rx="6" />
          <text className="schicht-text" y="6" textAnchor="middle">
            {label}
          </text>
        </>
      );
    case "kachel":
      return (
        <>
          <rect className="korpus fuell-haus" x="-46" y="-30" width="92" height="60" rx="6" />
          <rect className="fuell-fenster" x="-34" y="-20" width="22" height="5" rx="2" />
          <text className="kachel-text" y="14" textAnchor="middle">
            {label}
          </text>
        </>
      );
    case "karte":
      return (
        <>
          <rect className="korpus fuell-doc" x="-42" y="-30" width="84" height="60" rx="5" />
          <circle className="fuell-person" cx="-20" cy="-8" r="8" />
          <path className="fuell-person" d="M-34 20 C-34 6 -6 6 -6 20 Z" />
          <line className="doc-linie" x1="2" x2="30" y1="-10" y2="-10" />
          <line className="doc-linie" x1="2" x2="22" y1="2" y2="2" />
          {beschriftung(50)}
        </>
      );
    case "kalender":
      return (
        <>
          <rect className="korpus fuell-doc" x="-58" y="-46" width="116" height="92" rx="5" />
          <rect className="fuell-schicht" x="-58" y="-46" width="116" height="16" rx="5" />
          {Array.from({ length: 21 }, (_, i) => (
            <rect
              key={i}
              className={werte.includes(i) ? "kal-tag an" : "kal-tag"}
              x={-48 + (i % 7) * 14}
              y={-22 + Math.floor(i / 7) * 22}
              width="11"
              height="16"
              rx="2"
            />
          ))}
          {beschriftung(66)}
        </>
      );
    case "balken":
      return (
        <>
          <rect className="korpus fuell-kasten" x="-62" y="-70" width="124" height="120" rx="6" />
          {[0, 1, 2].map((i) => (
            <rect
              key={i}
              className="balken"
              x={-44 + i * 32}
              y={40 - Math.max(4, (werte[i] ?? 0) * 90)}
              width="22"
              height={Math.max(4, (werte[i] ?? 0) * 90)}
              rx="3"
            />
          ))}
          {beschriftung(74)}
        </>
      );
    case "checkliste":
      return (
        <>
          <rect className="korpus fuell-doc" x="-40" y="-52" width="80" height="104" rx="5" />
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <rect className="box" x="-30" y={-38 + i * 30} width="18" height="18" rx="3" />
              {werte[i] ? (
                <path className="haken-strich" d={`M-27 ${-28 + i * 30} L-22 ${-23 + i * 30} L-14 ${-33 + i * 30}`} />
              ) : null}
              <line className="doc-linie" x1="-4" x2="28" y1={-29 + i * 30} y2={-29 + i * 30} />
            </g>
          ))}
          {beschriftung(72)}
        </>
      );
    case "glocke":
      return (
        <>
          <path className="korpus fuell-schicht" d="M-22 14 C-22 -10 -16 -26 0 -28 C16 -26 22 -10 22 14 Z" />
          <rect className="fuell-schicht" x="-26" y="12" width="52" height="7" rx="3" />
          <circle className="fuell-schicht" cx="0" cy="26" r="5" />
          {beschriftung(50)}
        </>
      );
    case "lupe":
      return (
        <>
          <circle className="korpus lupe" cx="-4" cy="-4" r="20" />
          <line className="lupe" x1="11" y1="11" x2="30" y2="30" />
          {beschriftung(54)}
        </>
      );
    case "gluehbirne":
      return (
        <>
          <circle className="korpus fuell-fenster" cx="0" cy="-8" r="24" />
          <rect className="fuell-person" x="-12" y="14" width="24" height="12" rx="3" />
          {beschriftung(48)}
        </>
      );
    case "buch":
      return (
        <>
          <rect className="korpus fuell-haus" x="-62" y="-44" width="124" height="88" rx="5" />
          <line className="doc-linie" x1="0" x2="0" y1="-44" y2="44" />
          <rect className="fuell-fenster" x="-52" y="-34" width="40" height="5" rx="2" />
          <rect className="fuell-fenster" x="12" y="-34" width="40" height="5" rx="2" />
          {beschriftung(66)}
        </>
      );
    case "schluessel":
      return (
        <>
          <circle className="korpus key" cx="-18" cy="0" r="14" />
          <line className="key" x1="-4" y1="0" x2="40" y2="0" />
          <line className="key" x1="28" y1="0" x2="28" y2="12" />
          <line className="key" x1="38" y1="0" x2="38" y2="9" />
          {beschriftung(38)}
        </>
      );
    case "teller":
      return (
        <>
          <ellipse className="korpus fuell-doc" cx="0" cy="8" rx="44" ry="18" />
          <ellipse className="fuell-fenster" cx="0" cy="4" rx="24" ry="9" />
          {beschriftung(50)}
        </>
      );
    case "zahnrad":
      return (
        <>
          <circle className="korpus zahn" cx="0" cy="0" r="22" />
          <circle className="zahn-aussen" cx="0" cy="0" r="30" />
          <circle className="fuell-haus" cx="0" cy="0" r="9" />
          {beschriftung(56)}
        </>
      );
    case "ticket":
      return (
        <>
          <rect className="korpus fuell-doc" x="-40" y="-26" width="80" height="52" rx="6" />
          <rect className="fuell-schicht" x="-40" y="-26" width="12" height="52" rx="6" />
          <line className="doc-linie" x1="-18" x2="28" y1="-8" y2="-8" />
          <line className="doc-linie" x1="-18" x2="14" y1="6" y2="6" />
          {beschriftung(46)}
        </>
      );
    case "raum":
      return (
        <>
          <rect className="korpus fuell-haus" x="-56" y="-44" width="112" height="88" rx="5" />
          <rect className="fuell-fenster" x="-44" y="-32" width="30" height="22" rx="2" />
          <rect className="fuell-doc" x="14" y="-6" width="26" height="50" rx="2" />
          {beschriftung(64)}
        </>
      );
  }
}

function Marke({ art }: { art: NonNullable<SzenenAbzeichen> }) {
  return (
    <g className={`abz abz-${art}`}>
      <circle r="12" />
      {art === "haken" ? <path d="M-6 0 L-2 5 L7 -5" /> : null}
      {art === "uhr" ? <path d="M0 -6 V0 L5 3" /> : null}
      {art === "frage" ? (
        <text y="5" textAnchor="middle">
          ?
        </text>
      ) : null}
    </g>
  );
}

function Buehne({ szene, schritt, titel }: { szene: Szene; schritt: number; titel: string }) {
  const stand = standNach(szene, schritt);
  return (
    <svg
      viewBox={`0 0 ${SZENE_BREITE} ${SZENE_HOEHE}`}
      role="img"
      aria-label={`${titel}: ${szene.schritte[schritt].titel}`}
    >
      <defs>
        <linearGradient id="b-himmel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0B121A" />
          <stop offset="1" stopColor="#223142" />
        </linearGradient>
      </defs>
      <rect width={SZENE_BREITE} height={SZENE_HOEHE} fill="url(#b-himmel)" />
      {Array.from({ length: 26 }, (_, i) => (
        <circle
          key={i}
          cx={(i * 173) % SZENE_BREITE}
          cy={10 + ((i * 61) % 70)}
          r={i % 5 === 0 ? 1.7 : 1}
          fill="#fff"
          opacity={0.2 + (i % 4) * 0.1}
        />
      ))}
      <rect y="292" width={SZENE_BREITE} height="48" fill="#101820" />
      {szene.figuren.map((figur) => {
        const z = stand[figur.id];
        const klasse = ["el", z.rand ? `rand-${z.rand}` : "", z.gedimmt ? "dim" : "", z.sichtbar ? "" : "weg"]
          .filter(Boolean)
          .join(" ");
        return (
          <g key={figur.id} className={klasse} style={{ transform: `translate(${z.x}px, ${z.y}px)` }}>
            <Koerper art={figur.art} label={z.label} werte={z.werte} />
            {z.abzeichen ? (
              <g transform="translate(28 -34)">
                <Marke key={z.abzeichen} art={z.abzeichen} />
              </g>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

export function ModulSlideshow({ schluessel, onClose }: { schluessel: string; onClose: () => void }) {
  const szene = szeneFuer(schluessel);
  const modul = getModule(schluessel);
  const [schritt, setSchritt] = useState(0);
  const [spielt, setSpielt] = useState(false);
  const zuRef = useRef<HTMLButtonElement>(null);
  const letzter = (szene?.schritte.length ?? 1) - 1;

  // Fokus ins Fenster holen und beim Schließen zurückgeben.
  useEffect(() => {
    const vorher = document.activeElement as HTMLElement | null;
    zuRef.current?.focus();
    return () => vorher?.focus?.();
  }, []);

  useEffect(() => {
    if (!spielt) return;
    const timer = window.setTimeout(() => {
      if (schritt < letzter) setSchritt((s) => s + 1);
      else setSpielt(false);
    }, 3800);
    return () => window.clearTimeout(timer);
  }, [spielt, schritt, letzter]);

  useEffect(() => {
    const auf = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setSchritt((s) => Math.min(letzter, s + 1));
      if (e.key === "ArrowLeft") setSchritt((s) => Math.max(0, s - 1));
    };
    window.addEventListener("keydown", auf);
    return () => window.removeEventListener("keydown", auf);
  }, [letzter, onClose]);

  if (!szene || !modul) return null;
  const aktuell = szene.schritte[schritt];

  return (
    <div className="slide-hintergrund" onClick={onClose}>
      <div
        className="slide-fenster"
        role="dialog"
        aria-modal="true"
        aria-label={`So arbeitet ${modul.label}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="slide-kopf">
          <div>
            <span className="eyebrow">So arbeitet</span>
            <h3>{modul.label}</h3>
          </div>
          <button ref={zuRef} type="button" className="btn" onClick={onClose}>
            Schließen
          </button>
        </div>

        <div className="buehne">
          <Buehne szene={szene} schritt={schritt} titel={modul.label} />
          <div className="zaehler" aria-hidden="true">
            {schritt + 1} / {letzter + 1}
          </div>
        </div>

        <div className="untertitel" aria-live="polite">
          <h3>{aktuell.titel}</h3>
          <p>{aktuell.text}</p>
        </div>

        <div className="steuerung">
          <button type="button" className="btn" disabled={schritt === 0} onClick={() => setSchritt(schritt - 1)}>
            Zurück
          </button>
          <div className="punkte" role="group" aria-label="Schritte">
            {szene.schritte.map((s, i) => (
              <button
                key={s.titel}
                type="button"
                className={`punkt ${i === schritt ? "an" : i < schritt ? "vorbei" : ""}`}
                aria-label={`Schritt ${i + 1}: ${s.titel}`}
                aria-current={i === schritt}
                onClick={() => setSchritt(i)}
              />
            ))}
          </div>
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (!spielt && schritt === letzter) setSchritt(0);
              setSpielt(!spielt);
            }}
          >
            {spielt ? "Pause" : schritt === letzter ? "Nochmal" : "Abspielen"}
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={schritt === letzter}
            onClick={() => setSchritt(schritt + 1)}
          >
            Weiter
          </button>
        </div>
      </div>
    </div>
  );
}
