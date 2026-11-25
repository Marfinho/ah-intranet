"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  HAEUSER_MAX,
  MODULE_DEFINITIONS,
  MODULE_GROUP_LABELS,
  PITCH_FAELLE,
  NUTZER_MAX,
  TIERS,
  berechneAngebot,
  einzelmodulPreis,
  formatEuro,
  getModule,
  hatServiceOderWerkstatt,
  istSonntagsgeoeffnet,
  mitSonntag,
  vorschlagFuerStandort,
  waehlbareModule,
  type LeadKonfiguration,
  type ModuleDefinition,
  type PitchAnsicht,
  type PitchStandort,
  type PitchStandortEingabe,
  type TierKey,
} from "@ah-intranet/shared";
import { pitchAnfrageAction, pitchSpeichernAction, type PitchKonfiguration } from "@/lib/actions";
import { Buehne, ModulSlideshow } from "./modul-slideshow";

const STATIONEN = ["AHOI", "Start", "Ihre Häuser", "Funktionen", "Ihr Angebot", "Ihr Alltag"] as const;

const label = (key: string) => getModule(key)?.label ?? key;
const istBeta = (key: string) => getModule(key)?.stage === "beta";

export function Pitch({ token, ansicht }: { token: string; ansicht: PitchAnsicht }) {
  const [station, setStation] = useState(0);
  // Die Auswahl gehört der ganzen Seite: das Angebot ändert sie, das Sternbild zeigt sie.
  const [konf, setKonf] = useState<LeadKonfiguration>(ansicht.konfiguration);
  // Die Häuser gehören ebenfalls der ganzen Seite: wer sie hier verändert, sieht es im Angebot und im Intranet.
  const [standorte, setStandorte] = useState<PitchStandort[]>(ansicht.standorte);
  const [stand, setStand] = useState<Speicherstand>("bereit");
  const live = useMemo<PitchAnsicht>(() => ({ ...ansicht, standorte }), [ansicht, standorte]);
  const nutzlast = useMemo<PitchKonfiguration>(
    () => ({ ...konf, standorte: standorte.map(alsEingabe) }),
    [konf, standorte],
  );

  // Die Zahl der Häuser im Angebot folgt der Liste. Der Interessent kann sie dort weiter von Hand ändern.
  const letzteAnzahl = useRef(standorte.length);
  useEffect(() => {
    if (letzteAnzahl.current === standorte.length) return;
    letzteAnzahl.current = standorte.length;
    setKonf((alt) => ({ ...alt, haeuser: standorte.length }));
  }, [standorte.length]);

  // Auswahl und Häuser bleiben erhalten, wenn jemand die Seite später noch einmal öffnet.
  const erster = useRef(true);
  useEffect(() => {
    if (erster.current) {
      erster.current = false;
      return;
    }
    setStand("speichert");
    const timer = setTimeout(async () => {
      const ergebnis = await pitchSpeichernAction(token, nutzlast);
      setStand(ergebnis.ok ? "gespeichert" : "fehler");
    }, 700);
    return () => clearTimeout(timer);
  }, [nutzlast, token]);

  const gehe = (nummer: number) => {
    setStation(Math.max(0, Math.min(STATIONEN.length - 1, nummer)));
    window.scrollTo({ top: 0 });
  };

  useEffect(() => {
    const auf = (ereignis: KeyboardEvent) => {
      if (/INPUT|SELECT|TEXTAREA/.test((ereignis.target as HTMLElement).tagName)) return;
      // Bei offenem Fenster gehören die Pfeiltasten dem Fenster, nicht der Seite.
      if (document.querySelector('[role="dialog"]')) return;
      if (ereignis.key === "ArrowRight") setStation((s) => Math.min(STATIONEN.length - 1, s + 1));
      if (ereignis.key === "ArrowLeft") setStation((s) => Math.max(0, s - 1));
    };
    window.addEventListener("keydown", auf);
    return () => window.removeEventListener("keydown", auf);
  }, []);

  return (
    <div className="pitch">
      <header>
        <div className="wrap">
          <div className="bar">
            <div className="brand">
              {ansicht.name} <span>×</span> AHOI
            </div>
            <nav className="nav" aria-label="Stationen">
              {STATIONEN.map((name, index) => (
                <button key={name} type="button" aria-current={index === station} onClick={() => gehe(index)}>
                  {name}
                </button>
              ))}
            </nav>
          </div>
        </div>
        <div className="prog">
          <i style={{ width: `${((station + 1) / STATIONEN.length) * 100}%` }} />
        </div>
      </header>

      <main className="wrap">
        {station === 0 ? <Namensseite onWeiter={() => gehe(1)} /> : null}
        {station === 1 ? <Start ansicht={live} /> : null}
        {station === 2 ? (
          <Haeuser standorte={standorte} setStandorte={setStandorte} ausgang={ansicht.ausgang} stand={stand} />
        ) : null}
        {station === 3 ? <Funktionen ansicht={live} /> : null}
        {station === 4 ? (
          <Angebot token={token} ansicht={ansicht} konf={konf} setKonf={setKonf} nutzlast={nutzlast} stand={stand} />
        ) : null}
        {station === 5 ? <Alltag konf={konf} onAngebot={() => gehe(4)} /> : null}

        {/* Auf der letzten Seite hat der Ablauf eigene Knöpfe; ein zweites Paar darunter wäre verwirrend. */}
        {station < STATIONEN.length - 1 ? (
          <div className="pager">
            <button type="button" className="btn" disabled={station === 0} onClick={() => gehe(station - 1)}>
              Zurück
            </button>
            <button type="button" className="btn primary" onClick={() => gehe(station + 1)}>
              Weiter
            </button>
          </div>
        ) : null}
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ Start */

function Start({ ansicht }: { ansicht: PitchAnsicht }) {
  const marken = useMemo(() => [...new Set(ansicht.standorte.flatMap((standort) => standort.marken))], [ansicht]);
  const verbuende = useMemo(() => {
    const zaehler = new Map<string, number>();
    for (const standort of ansicht.standorte) {
      if (standort.campus) zaehler.set(standort.campus, (zaehler.get(standort.campus) ?? 0) + 1);
    }
    return [...zaehler.values()].filter((anzahl) => anzahl > 1).length;
  }, [ansicht]);

  return (
    <section className="station" style={{ paddingTop: 56 }}>
      <div className="eyebrow">Vorschlag für {ansicht.name}</div>
      <h1 style={{ marginTop: 14 }}>{ansicht.standorte.length} Häuser. Ein Intranet.</h1>
      <p className="lead">
        Aushänge, Bestellungen, Freigaben, Anträge, Serviceanfragen, Einarbeitung: der Betriebsalltag aller Ihrer Häuser
        an einer Stelle. Das Autogeschäft bleibt im DMS, wo es hingehört. Diese Seite ist auf Ihre Standorte
        zugeschnitten. Stellen Sie ein, was Sie brauchen, und sehen Sie sofort, was es kostet.
      </p>
      <div className="facts">
        <div className="fact">
          <b>{ansicht.standorte.length}</b>
          <span>Häuser, jedes mit eigenem Alltag</span>
        </div>
        <div className="fact">
          <b>{marken.length}</b>
          <span>Marken unter einem Dach</span>
        </div>
        {verbuende > 0 ? (
          <div className="fact">
            <b>{verbuende}</b>
            <span>{verbuende === 1 ? "Standortverbund" : "Standortverbünde"} mit gemeinsamer Nutzung</span>
          </div>
        ) : null}
        <div className="fact">
          <b>{MODULE_DEFINITIONS.length}</b>
          <span>Module, jedes einzeln zuschaltbar</span>
        </div>
      </div>
      <p className="hint" style={{ marginTop: 28 }}>
        Weiter mit der Schaltfläche, den Pfeiltasten oder den Reitern oben.
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------- Name */

/**
 * Alltagssituationen aus dem Betrieb. Jede löst sich in Punkte auf, die in "ihr"
 * Wort wandern: Situationen rund um Häuser und Marken werden zu "Autohaus",
 * Abläufe zu "Organisation", Auskünfte zu "Information". Die ersten drei stehen
 * so lange, dass man sie lesen kann. Die übrigen erscheinen von derselben
 * Stelle oben in der Mitte und fliegen immer schneller in ihr Wort. Die
 * Beispiele sind allgemein gehalten und für jeden Interessenten gleich.
 */
type Zeile = 0 | 1 | 2;
const LANGSAM: { text: string; zeile: Zeile }[] = [
  { text: "Fr. Müller braucht Urlaub", zeile: 1 },
  { text: "Hr. Kopernikus sucht die Telefonnummer von Fr. Hülse im anderen Standort", zeile: 2 },
  { text: "Hr. Meyer braucht einen Raum für ein Meeting", zeile: 1 },
];
const SCHNELL: { text: string; zeile: Zeile }[] = [
  { text: "Eine neue Marke zieht ein: wer sieht was?", zeile: 0 },
  { text: "Die neue Regel zur Fahrzeugübergabe muss alle erreichen", zeile: 2 },
  { text: "Zwei Häuser am selben Standort teilen sich Räume und Termine", zeile: 0 },
  { text: "Die Werkstatt braucht neue Arbeitskleidung", zeile: 1 },
  { text: "Wo liegt das aktuelle Garantieformular?", zeile: 2 },
  { text: "Jedes Haus hat eigene Abläufe und gehört doch zusammen", zeile: 0 },
  { text: "Eine Hebebühne ist defekt", zeile: 1 },
  { text: "Wer ist für die Zulassung zuständig?", zeile: 2 },
  { text: "Hr. Schulz möchte den Sonntagsdienst tauschen", zeile: 1 },
  { text: "Der Standort Nord eröffnet am Montag", zeile: 0 },
  { text: "Welche Öffnungszeiten gelten an Feiertagen?", zeile: 2 },
  { text: "Visitenkarten für die neue Verkäuferin", zeile: 1 },
  { text: "Das Verkaufshaus hat samstags länger geöffnet", zeile: 0 },
  { text: "Heute ist die Schulung zur neuen Marke", zeile: 2 },
  { text: "Der Urlaubsantrag wartet auf die Leitung", zeile: 1 },
  { text: "Haus Süd hat keine eigene Werkstatt", zeile: 0 },
  { text: "Wo ist die Preisliste vom letzten Jahr?", zeile: 2 },
  { text: "Wer hat den Schlüssel zum Vorführwagen?", zeile: 1 },
  { text: "Ein Haus wechselt die Marke", zeile: 0 },
  { text: "Wie läuft eine Probefahrt ab?", zeile: 2 },
  { text: "Die Sammelbestellung geht Freitag raus", zeile: 1 },
  { text: "Die Werkstatt braucht eigene Abläufe", zeile: 0 },
  { text: "Wer vertritt Fr. Hülse nächste Woche?", zeile: 2 },
  { text: "Der neue Kollege startet am Montag", zeile: 1 },
  { text: "Das Autohaus plant den Tag der offenen Tür", zeile: 0 },
  { text: "Hat jeder den Aushang zum Arbeitsschutz gelesen?", zeile: 2 },
  { text: "Die Schulung am Dienstag braucht einen Raum", zeile: 1 },
  { text: "Alle Häuser brauchen dieselben Vorgaben", zeile: 0 },
  { text: "Wo steht die Anleitung für die Inzahlungnahme?", zeile: 2 },
  { text: "Hr. Albers beantragt einen Tag Gleitzeit", zeile: 1 },
  { text: "Zwei Marken unter einem Dach brauchen getrennte Zuständigkeiten", zeile: 0 },
  { text: "Wer ist im Haus Süd für Teile zuständig?", zeile: 2 },
  { text: "Ein Kundenschlüssel geht an die Werkstatt", zeile: 1 },
  { text: "Ein neuer Standort braucht Konten, Rollen und Abteilungen", zeile: 0 },
  { text: "Gilt die neue Preisaktion auch im Nachbarhaus?", zeile: 2 },
  { text: "Eine Idee zur besseren Terminplanung der Werkstatt", zeile: 1 },
  { text: "Eine Marke wird an zwei Standorten verkauft", zeile: 0 },
];
const BEISPIELE = [...LANGSAM, ...SCHNELL];

/**
 * Ablauf in Sekunden.
 *
 * Die ersten drei fliegen ein und stehen drei, fünf und vier Sekunden.
 * Die übrigen erscheinen oben in der Mitte, bleiben kurz stehen und fliegen dann
 * los. Verweildauer, Flugzeit und Abstand schrumpfen von Karte zu Karte: Nr. 4 bis
 * 8 lassen sich noch lesen, danach wird es ein Strom.
 */
const NAME_START = 0.3;
const NAME_FLUG = 0.9;
const NAME_AUFLOESEN = 1.5;
const NAME_AUFLOESEN_SCHNELL = 0.9;
/** Wie lange die ersten drei Beispiele stehen, in Sekunden. */
const LESEZEIT = [3, 5, 4];
/**
 * Zeitkurven der schnellen Beispiele. Die ersten fünf (Nr. 4 bis 8) sind fest
 * gewählt, damit man sie noch liest. Danach werden Verweildauer, Flugzeit und
 * Abstand gleichmäßig kürzer und erreichen bei Nr. 31 ihren Boden: die letzten
 * zehn stehen nur noch eine Zehntelsekunde.
 */
const SCHNELL_ANFANG = {
  verweilen: [1.3, 1.1, 0.95, 0.8, 0.7],
  flug: [1.0, 0.9, 0.8, 0.7, 0.65],
  abstand: [2.0, 1.7, 1.45, 1.25, 1.05],
};
const schnellwert = (anfang: number[], i: number, start: number, faktor: number, boden: number) =>
  i < anfang.length ? anfang[i] : Math.max(boden, start * Math.pow(faktor, i - anfang.length));
const SCHNELL_VERWEILEN = SCHNELL.map((_, i) => schnellwert(SCHNELL_ANFANG.verweilen, i, 0.55, 0.934, 0.1));
const SCHNELL_FLUG = SCHNELL.map((_, i) => schnellwert(SCHNELL_ANFANG.flug, i, 0.6, 0.9726, 0.3));
const SCHNELL_ABSTAND = SCHNELL.map((_, i) => schnellwert(SCHNELL_ANFANG.abstand, i, 0.85, 0.918, 0.1));

/** Wann jedes Beispiel erscheint, losfliegt und sich auflöst, und wie lange das Auflösen dauert. */
const BEISPIEL_BEGINN: number[] = [];
const BEISPIEL_LOS: number[] = [];
const BEISPIEL_AUFLOESUNG: number[] = [];
const BEISPIEL_DAUER: number[] = [];
let laufzeit = NAME_START;
LANGSAM.forEach((_, k) => {
  BEISPIEL_BEGINN[k] = laufzeit;
  BEISPIEL_LOS[k] = laufzeit + NAME_FLUG;
  BEISPIEL_AUFLOESUNG[k] = laufzeit + NAME_FLUG + LESEZEIT[k];
  BEISPIEL_DAUER[k] = NAME_AUFLOESEN;
  laufzeit = BEISPIEL_AUFLOESUNG[k];
});
const NAME_LANGSAM_ENDE = laufzeit;
SCHNELL.forEach((_, i) => {
  const k = LANGSAM.length + i;
  BEISPIEL_BEGINN[k] = laufzeit;
  BEISPIEL_LOS[k] = laufzeit + SCHNELL_VERWEILEN[i];
  BEISPIEL_AUFLOESUNG[k] = BEISPIEL_LOS[k] + SCHNELL_FLUG[i];
  BEISPIEL_DAUER[k] = NAME_AUFLOESEN_SCHNELL;
  laufzeit += SCHNELL_ABSTAND[i];
});
const NAME_WOERTER_FERTIG = Math.max(...BEISPIEL_AUFLOESUNG.map((zeit, k) => zeit + BEISPIEL_DAUER[k]));
const NAME_KUERZEN = { von: NAME_WOERTER_FERTIG + 1.4, dauer: 1.6 };
const NAME_ZEICHEN = NAME_KUERZEN.von + NAME_KUERZEN.dauer - 0.1;
const NAME_DAUER = NAME_ZEICHEN + 1.6;
/** Höhe des Streifens oben, in dem die Beispiele erscheinen. */
const NAME_STREIFEN = 104;

const weich = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
};

type Merkmal = "A" | "H" | "O" | "I" | null;
interface Punkt {
  x: number;
  y: number;
  merkmal: Merkmal;
  zeile: number;
}
interface Teilchen {
  beispiel: number;
  sx: number;
  sy: number;
  ax: number;
  ay: number;
  bx: number;
  by: number;
  merkmal: Merkmal;
  verzug: number;
}
interface Karte {
  zeilen: string[];
  breite: number;
  hoehe: number;
  /** Ort, an dem jede Karte erscheint: oben in der Mitte. */
  startX: number;
  startY: number;
  /** Wohin eine schnelle Karte fliegt und aufplatzt. */
  zielX: number;
  zielY: number;
  seite: 1 | -1;
}

/** Wiederholbarer Zufall: das Bild soll bei jedem Durchlauf gleich entstehen. */
function zufall(startwert: number) {
  let zustand = startwert;
  return () => {
    zustand = (zustand + 0x6d2b79f5) | 0;
    let t = Math.imul(zustand ^ (zustand >>> 15), 1 | zustand);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SCHRIFT = '"Barlow Condensed", "Arial Narrow", Arial, sans-serif';

/** Rastert Zeilen Text zu Punkten. Merkmal: gehört der Buchstabe zum Namen AHOI? */
function rastere(
  breite: number,
  hoehe: number,
  bereich: { oben: number; hoehe: number },
  zeilen: string[],
  schriftgroesse: number,
  schritt: number,
  merkmalFuer: (zeile: number, index: number) => Merkmal,
): Punkt[] {
  const leinwand = document.createElement("canvas");
  leinwand.width = breite;
  leinwand.height = hoehe;
  const ctx = leinwand.getContext("2d", { willReadFrequently: true })!;
  const hoeheZeile = schriftgroesse * 1.04;
  const oben = bereich.oben + (bereich.hoehe - hoeheZeile * zeilen.length) / 2;
  ctx.font = `800 ${schriftgroesse}px ${SCHRIFT}`;
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#000";

  const buchstaben: { von: number; bis: number; zeile: number; index: number }[] = [];
  zeilen.forEach((zeile, z) => {
    const gesamt = ctx.measureText(zeile).width;
    const links = (breite - gesamt) / 2;
    ctx.fillText(zeile, links, oben + hoeheZeile * (z + 0.52));
    for (let i = 0; i < zeile.length; i += 1) {
      buchstaben.push({
        von: links + ctx.measureText(zeile.slice(0, i)).width,
        bis: links + ctx.measureText(zeile.slice(0, i + 1)).width,
        zeile: z,
        index: i,
      });
    }
  });

  const daten = ctx.getImageData(0, 0, breite, hoehe).data;
  const punkte: Punkt[] = [];
  for (let y = 0; y < hoehe; y += schritt) {
    for (let x = 0; x < breite; x += schritt) {
      if (daten[(y * breite + x) * 4 + 3] < 128) continue;
      const z = Math.min(zeilen.length - 1, Math.max(0, Math.floor((y - oben) / hoeheZeile)));
      const treffer = buchstaben.find((b) => b.zeile === z && x >= b.von && x < b.bis);
      punkte.push({ x, y, zeile: z, merkmal: treffer ? merkmalFuer(treffer.zeile, treffer.index) : null });
    }
  }
  return punkte;
}

/** Bricht einen Satz auf eine Breite um. */
function umbrechen(ctx: CanvasRenderingContext2D, text: string, breite: number): string[] {
  const zeilen: string[] = [];
  let aktuell = "";
  for (const wort of text.split(" ")) {
    const probe = aktuell ? `${aktuell} ${wort}` : wort;
    if (aktuell && ctx.measureText(probe).width > breite) {
      zeilen.push(aktuell);
      aktuell = wort;
    } else {
      aktuell = probe;
    }
  }
  if (aktuell) zeilen.push(aktuell);
  return zeilen;
}

function baueSzene(breite: number, hoehe: number, kartenSchrift: number) {
  const zufallswert = zufall(7);
  const wortZeilen = ["AUTOHAUS", "ORGANISATION", "INFORMATION"];
  const messen = document.createElement("canvas").getContext("2d")!;
  const probe = 100;
  messen.font = `800 ${probe}px ${SCHRIFT}`;
  const breitesteZeile = Math.max(...wortZeilen.map((zeile) => messen.measureText(zeile).width)) / probe;
  const wortBereich = { oben: NAME_STREIFEN, hoehe: hoehe - NAME_STREIFEN };
  const groesse1 = Math.max(18, Math.min((breite * 0.82) / breitesteZeile, wortBereich.hoehe / 3.4));

  const woerter = rastere(breite, hoehe, wortBereich, wortZeilen, groesse1, 3, (zeile, index) =>
    zeile === 0 && index === 0
      ? "A"
      : zeile === 0 && index === 4
        ? "H"
        : zeile === 1 && index === 0
          ? "O"
          : zeile === 2 && index === 0
            ? "I"
            : null,
  );

  const breiteAhoi = messen.measureText("AHOI").width / probe;
  const groesse2 = Math.max(24, Math.min((breite * 0.7) / breiteAhoi, hoehe * 0.72));
  const name = rastere(
    breite,
    hoehe,
    { oben: 0, hoehe },
    ["AHOI"],
    groesse2,
    3,
    (_zeile, index) => (["A", "H", "O", "I"] as const)[index],
  );

  const gemischt = <T,>(liste: T[]) => {
    const kopie = [...liste];
    for (let i = kopie.length - 1; i > 0; i -= 1) {
      const j = Math.floor(zufallswert() * (i + 1));
      [kopie[i], kopie[j]] = [kopie[j], kopie[i]];
    }
    return kopie;
  };
  const alleNamenspunkte = gemischt(name);
  const jeBuchstabe: Record<string, Punkt[]> = { A: [], H: [], O: [], I: [] };
  for (const punkt of alleNamenspunkte) if (punkt.merkmal) jeBuchstabe[punkt.merkmal].push(punkt);
  const zaehler: Record<string, number> = { A: 0, H: 0, O: 0, I: 0 };
  let allgemein = 0;

  // Die Punkte eines Wortes verteilen sich reihum auf die Beispiele, die zu ihm gehören:
  // jedes liefert einen gleichmäßigen Teil, das Wort füllt sich mit jedem Beispiel.
  const jeZeile: number[][] = [[], [], []];
  BEISPIELE.forEach((beispiel, index) => jeZeile[beispiel.zeile].push(index));
  const zaehlerZeile = [0, 0, 0];

  const anzahl = Math.max(woerter.length, Math.ceil(name.length * 1.2));
  const teilchen: Teilchen[] = [];
  const ziele: (Punkt | null)[] = BEISPIELE.map(() => null);
  for (let i = 0; i < anzahl; i += 1) {
    const ziel1 = woerter[i % woerter.length];
    const verfuegbar = jeZeile[ziel1.zeile];
    const beispiel = verfuegbar[zaehlerZeile[ziel1.zeile]++ % verfuegbar.length];
    let ziel2: Punkt;
    if (ziel1.merkmal) {
      const liste = jeBuchstabe[ziel1.merkmal];
      ziel2 = liste[zaehler[ziel1.merkmal]++ % liste.length];
    } else {
      ziel2 = alleNamenspunkte[allgemein++ % alleNamenspunkte.length];
    }
    teilchen.push({
      beispiel,
      sx: 0,
      sy: 0,
      ax: ziel1.x + (zufallswert() - 0.5) * 1.2,
      ay: ziel1.y + (zufallswert() - 0.5) * 1.2,
      bx: ziel2.x + (zufallswert() - 0.5) * 1.2,
      by: ziel2.y + (zufallswert() - 0.5) * 1.2,
      merkmal: ziel1.merkmal,
      verzug: zufallswert() * 0.4,
    });
  }

  // Schnelle Karten fliegen an eine zufällige Stelle ihres Wortes und platzen dort auf.
  const jeZeilePunkte: Punkt[][] = [[], [], []];
  for (const punkt of woerter) jeZeilePunkte[punkt.zeile].push(punkt);
  BEISPIELE.forEach((beispiel, k) => {
    if (k < LANGSAM.length) return;
    const punkte = jeZeilePunkte[beispiel.zeile];
    ziele[k] = punkte[Math.floor(zufallswert() * punkte.length)];
  });

  // Alle Karten sind gleich groß und erscheinen an derselben Stelle oben in der Mitte.
  messen.font = `600 ${kartenSchrift}px ${SCHRIFT}`;
  const kartenBreite = Math.min(breite - 24, 620);
  const karten: Karte[] = BEISPIELE.map((beispiel, k) => {
    const zeilen = umbrechen(messen, beispiel.text, kartenBreite - 40);
    const ziel = ziele[k];
    return {
      zeilen,
      breite: kartenBreite,
      hoehe: Math.min(NAME_STREIFEN - 12, zeilen.length * kartenSchrift * 1.25 + 24),
      startX: breite / 2,
      startY: NAME_STREIFEN / 2,
      zielX: ziel ? ziel.x : breite / 2,
      zielY: ziel ? ziel.y : NAME_STREIFEN / 2,
      seite: zufallswert() < 0.5 ? -1 : 1,
    };
  });

  // Die Punkte starten dort, wo ihre Karte sich auflöst: die ersten oben, die schnellen im Wort.
  for (const t of teilchen) {
    const karte = karten[t.beispiel];
    if (t.beispiel < LANGSAM.length) {
      t.sx = karte.startX + (zufallswert() - 0.5) * karte.breite * 0.9;
      t.sy = karte.startY + (zufallswert() - 0.5) * karte.hoehe * 0.8;
    } else {
      t.sx = karte.zielX + (zufallswert() - 0.5) * karte.breite * 0.3;
      t.sy = karte.zielY + (zufallswert() - 0.5) * karte.hoehe * 0.3;
    }
  }
  return { teilchen, karten, woerter };
}

function farbe(name: string, vorgabe: string): string {
  const wert = getComputedStyle(document.querySelector(".pitch") ?? document.body)
    .getPropertyValue(name)
    .trim();
  return wert || vorgabe;
}

function mische(von: string, nach: string, anteil: number): string {
  const zahl = (hex: string) => {
    const t = hex.replace("#", "");
    const voll =
      t.length === 3
        ? t
            .split("")
            .map((c) => c + c)
            .join("")
        : t;
    return [0, 2, 4].map((i) => parseInt(voll.slice(i, i + 2), 16));
  };
  const a = zahl(von);
  const b = zahl(nach);
  return `rgb(${a.map((w, i) => Math.round(w + (b[i] - w) * anteil)).join(",")})`;
}

/**
 * Erste Seite: wie der Name entsteht.
 *
 * Alltagssituationen erscheinen nacheinander und stehen je fünf Sekunden. Jede
 * löst sich in Punkte auf, die in das passende Wort wandern, bis AUTOHAUS,
 * ORGANISATION und INFORMATION dastehen. Dann ziehen sich die Punkte auf A, H, O
 * und I zusammen, und das Zeichen baut sich auf. Der Name ist eine Abkürzung,
 * kein Bild (docs/ci.md). Bei reduzierter Bewegung steht gleich das Ergebnis da.
 */
function Namensseite({ onWeiter }: { onWeiter: () => void }) {
  const leinwandRef = useRef<HTMLCanvasElement>(null);
  const versatz = useRef(0);
  const [zeit, setZeit] = useState(0);
  const [durchlauf, setDurchlauf] = useState(0);
  const [direkt, setDirekt] = useState(false);
  const [breite, setBreite] = useState(0);

  useEffect(() => {
    const leinwand = leinwandRef.current;
    if (!leinwand) return;
    const messe = () => setBreite(Math.round(leinwand.getBoundingClientRect().width));
    messe();
    const beobachter = new ResizeObserver(messe);
    beobachter.observe(leinwand);
    return () => beobachter.disconnect();
  }, []);

  useEffect(() => {
    const leinwand = leinwandRef.current;
    if (!leinwand || breite < 200) return;
    let abgebrochen = false;
    let rahmen = 0;
    versatz.current = 0;

    const starte = () => {
      if (abgebrochen) return;
      const hoehe = Math.round(Math.min(580, Math.max(440, breite * 0.62)));
      const dichte = Math.min(2, window.devicePixelRatio || 1);
      leinwand.width = Math.round(breite * dichte);
      leinwand.height = Math.round(hoehe * dichte);
      leinwand.style.height = `${hoehe}px`;
      const ctx = leinwand.getContext("2d")!;
      ctx.scale(dichte, dichte);

      const kartenSchrift = breite >= 600 ? 24 : 18;
      const { teilchen, karten, woerter } = baueSzene(breite, hoehe, kartenSchrift);
      const grund = farbe("--fg", "#15181B");
      const flaeche = farbe("--surface", "#FFFFFF");
      const linie = farbe("--line", "#D5D7D6");
      const leise = farbe("--quiet", "#737B80");
      const akzent = farbe("--accent-text", "#8F3F14");
      const akzentHell = farbe("--accent", "#B4531F");

      const zeichne = (t: number) => {
        ctx.clearRect(0, 0, breite, hoehe);
        const stufe = (lokal: number, verzug: number) => weich((lokal - verzug * 0.5) / 0.8);
        const zweiteStufe = weich((t - NAME_KUERZEN.von) / NAME_KUERZEN.dauer);

        // Das Ziel als schwacher Schatten: man sieht, wohin die Punkte wandern.
        ctx.globalAlpha = 0.1 * (1 - zweiteStufe);
        ctx.fillStyle = leise;
        for (const punkt of woerter) ctx.fillRect(punkt.x - 0.8, punkt.y - 0.8, 1.6, 1.6);
        ctx.globalAlpha = 1;

        // Beispiele: die ersten stehen so lange, dass man sie lesen kann; die übrigen erscheinen
        // an derselben Stelle oben in der Mitte und fliegen immer schneller in ihr Wort.
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.font = `600 ${kartenSchrift}px ${SCHRIFT}`;
        karten.forEach((karte, k) => {
          if (t < BEISPIEL_BEGINN[k] || t >= BEISPIEL_AUFLOESUNG[k] + (k < LANGSAM.length ? 0.6 : 0)) return;
          let mitteX = karte.startX;
          let mitteY = karte.startY;
          let mass = 1;
          let alpha: number;
          if (k < LANGSAM.length) {
            const da = (t - BEISPIEL_BEGINN[k]) / NAME_FLUG;
            const woher = karte.seite === -1 ? -karte.breite : breite + karte.breite;
            mitteX = woher + (karte.startX - woher) * weich(da);
            alpha = Math.min(1, da * 1.4) * (1 - weich((t - BEISPIEL_AUFLOESUNG[k]) / 0.6));
          } else {
            const i = k - LANGSAM.length;
            const da = (t - BEISPIEL_BEGINN[k]) / Math.min(0.25, SCHNELL_VERWEILEN[i]);
            alpha = Math.min(1, da);
            mass = 0.94 + 0.06 * Math.min(1, da);
            const flug = (t - BEISPIEL_LOS[k]) / SCHNELL_FLUG[i];
            if (flug > 0) {
              // Beschleunigt: erst langsam, dann zielstrebig in das Wort.
              const weg = Math.min(1, flug) ** 1.7;
              mitteX = karte.startX + (karte.zielX - karte.startX) * weg;
              mitteY = karte.startY + (karte.zielY - karte.startY) * weg;
              mass = 1 - (0.25 + 0.3 * (i / (SCHNELL.length - 1))) * weg;
            }
          }
          ctx.save();
          ctx.translate(mitteX, mitteY);
          ctx.scale(mass, mass);
          ctx.globalAlpha = alpha;
          ctx.fillStyle = flaeche;
          ctx.strokeStyle = linie;
          ctx.lineWidth = 1;
          ctx.beginPath();
          if (typeof ctx.roundRect === "function")
            ctx.roundRect(-karte.breite / 2, -karte.hoehe / 2, karte.breite, karte.hoehe, 10);
          else ctx.rect(-karte.breite / 2, -karte.hoehe / 2, karte.breite, karte.hoehe);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = grund;
          karte.zeilen.forEach((zeile, z) =>
            ctx.fillText(zeile, -karte.breite / 2 + 20, (z - (karte.zeilen.length - 1) / 2) * kartenSchrift * 1.25),
          );
          ctx.restore();
        });
        ctx.globalAlpha = 1;

        const nichtMerkmal = mische(grund, akzent, zweiteStufe);
        for (const durchgang of [false, true]) {
          ctx.fillStyle = durchgang ? akzentHell : nichtMerkmal;
          for (const p of teilchen) {
            if ((p.merkmal !== null) !== durchgang) continue;
            const seit = t - BEISPIEL_AUFLOESUNG[p.beispiel];
            if (seit < 0) continue;
            ctx.globalAlpha = weich(seit / 0.25);
            const e1 = stufe(seit / BEISPIEL_DAUER[p.beispiel], p.verzug);
            const e2 = stufe((t - NAME_KUERZEN.von) / NAME_KUERZEN.dauer, p.verzug);
            let x = p.sx + (p.ax - p.sx) * e1;
            let y = p.sy + (p.ay - p.sy) * e1;
            x += (p.bx - x) * e2;
            y += (p.by - y) * e2;
            // Am Ende werden die Punkte größer, damit der Name als Fläche steht.
            const gross = (e1 < 0.98 && e1 > 0.02 ? 2.6 : 2.2) + 1.1 * e2;
            ctx.fillRect(x - gross / 2, y - gross / 2, gross, gross);
          }
        }
        ctx.globalAlpha = 1;
      };

      if (direkt || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        zeichne(NAME_DAUER);
        setZeit(NAME_DAUER);
        return;
      }

      const start = performance.now();
      const schritt = (jetzt: number) => {
        const t = Math.min(NAME_DAUER, (jetzt - start) / 1000 + versatz.current);
        zeichne(t);
        setZeit(t);
        if (t < NAME_DAUER) rahmen = requestAnimationFrame(schritt);
      };
      rahmen = requestAnimationFrame(schritt);
    };

    // Erst starten, wenn die Hausschrift da ist: das Raster hängt an ihren Maßen.
    const schrift = document.fonts?.load('800 40px "Barlow Condensed"') ?? Promise.resolve();
    void schrift.catch(() => undefined).then(starte);
    return () => {
      abgebrochen = true;
      cancelAnimationFrame(rahmen);
    };
  }, [breite, durchlauf, direkt]);

  const fertig = zeit >= NAME_DAUER;
  const inSituationen = zeit < NAME_LANGSAM_ENDE;
  const aktuelle = LANGSAM.reduce((stand, _, k) => (zeit >= BEISPIEL_BEGINN[k] ? k : stand), 0);

  // Springt zum Beginn des nächsten Beispiels, indem die Uhr vorgestellt wird.
  const naechstes = () => {
    const ziel = aktuelle + 1 < LANGSAM.length ? BEISPIEL_BEGINN[aktuelle + 1] : NAME_LANGSAM_ENDE;
    versatz.current += Math.max(0, ziel - zeit) + 0.01;
  };

  return (
    <section className="station ahoi-seite">
      <h1 className="nur-lesen">AHOI: Autohaus Organisation und Information</h1>
      {!fertig ? (
        <div className="ahoi-steuerung">
          {inSituationen ? (
            <button type="button" onClick={naechstes}>
              Nächstes Beispiel
            </button>
          ) : null}
          <button type="button" onClick={() => setDirekt(true)}>
            Überspringen
          </button>
        </div>
      ) : null}

      <div className="ahoi-punkte" aria-hidden="true" style={{ opacity: inSituationen && zeit > NAME_START ? 1 : 0 }}>
        {LANGSAM.map((_, k) => (
          <i key={k} className={k < aktuelle ? "vorbei" : k === aktuelle ? "jetzt" : ""} />
        ))}
      </div>

      <canvas ref={leinwandRef} className="ahoi-leinwand" aria-hidden="true" />

      <svg
        className="ahoi-zeichen"
        viewBox="0 0 76 76"
        role="img"
        aria-label="Das AHOI-Zeichen: vier Felder, drei gefüllt, eines offen"
      >
        {[
          { x: 0, y: 0, offen: false },
          { x: 40, y: 0, offen: true },
          { x: 0, y: 40, offen: false },
          { x: 40, y: 40, offen: false },
        ].map((feld, index) => {
          const sichtbar = weich((zeit - NAME_ZEICHEN - index * 0.2) / 0.3);
          const mass = 0.7 + 0.3 * sichtbar;
          const mitte = { x: feld.x + 18, y: feld.y + 18 };
          return (
            <g
              key={index}
              opacity={sichtbar}
              transform={`translate(${mitte.x} ${mitte.y}) scale(${mass}) translate(${-mitte.x} ${-mitte.y})`}
            >
              {feld.offen ? (
                <rect className="z-offen" x={feld.x + 2} y={feld.y + 2} width="32" height="32" />
              ) : (
                <rect className="z-voll" x={feld.x} y={feld.y} width="36" height="36" />
              )}
            </g>
          );
        })}
      </svg>

      <p className="ahoi-unter" style={{ opacity: weich((zeit - (NAME_ZEICHEN + 0.5)) / 0.6) }}>
        Autohaus · Organisation · Information
      </p>

      <div className="ahoi-knoepfe" style={{ opacity: fertig ? 1 : 0, pointerEvents: fertig ? "auto" : "none" }}>
        <button
          type="button"
          className="btn"
          onClick={() => {
            setDirekt(false);
            setDurchlauf((n) => n + 1);
          }}
        >
          Nochmal
        </button>
        <button type="button" className="btn primary" onClick={onWeiter}>
          Los geht&apos;s
        </button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ Häuser */

/** Die Felder eines Hauses, die der Interessent verändern darf, in der Form, die der Server annimmt. */
function alsEingabe(haus: PitchStandort): PitchStandortEingabe {
  return {
    name: haus.name,
    adresse: haus.adresse,
    marken: haus.marken,
    leistungen: haus.leistungen,
    oeffnungszeiten: haus.oeffnungszeiten,
    campus: haus.campus,
  };
}

/**
 * Rechnet die Vorschläge neu. Ein Text, den der Betreiber von Hand geschrieben hat, bleibt
 * stehen, solange das Haus nicht verändert wird; ein verändertes Haus folgt den Regeln.
 */
function berechne(liste: PitchStandort[]): PitchStandort[] {
  return liste.map((haus) => {
    if (haus.vorschlagVonHand) return haus;
    const regel = vorschlagFuerStandort(haus, liste);
    return { ...haus, vorschlagText: regel.text, vorschlagModule: regel.module };
  });
}

function sindGleich(a: PitchStandort[], b: PitchStandort[]): boolean {
  return JSON.stringify(a.map(alsEingabe)) === JSON.stringify(b.map(alsEingabe));
}

const LEISTUNGEN: { name: string; bezeichnung: string; prueft: (leistungen: string[]) => boolean }[] = [
  { name: "Verkauf", bezeichnung: "Verkauf", prueft: (l) => l.some((e) => /verkauf/i.test(e)) },
  { name: "Service", bezeichnung: "Werkstatt", prueft: (l) => hatServiceOderWerkstatt(l) },
  { name: "Teiledienst", bezeichnung: "Teiledienst", prueft: (l) => l.some((e) => /teile/i.test(e)) },
];

function Haeuser({
  standorte,
  setStandorte,
  ausgang,
  stand,
}: {
  standorte: PitchStandort[];
  setStandorte: (liste: PitchStandort[]) => void;
  ausgang: PitchStandort[];
  stand: Speicherstand;
}) {
  const [gewaehlt, setGewaehlt] = useState(0);
  const [neueMarke, setNeueMarke] = useState("");
  const index = Math.min(gewaehlt, standorte.length - 1);
  const haus = standorte[index];
  const veraendert = !sindGleich(standorte, ausgang);
  const verbuende = [
    ...new Set(standorte.map((eintrag) => eintrag.campus).filter((name): name is string => Boolean(name))),
  ];

  // Jede Änderung markiert das Haus als verändert (der Regeltext ersetzt einen von Hand geschriebenen)
  // und rechnet die Vorschläge aller Häuser neu: ein Verbund betrifft die Nachbarn mit.
  const aendere = (nummer: number, teil: Partial<PitchStandort>) =>
    setStandorte(
      berechne(
        standorte.map((eintrag, i) => (i === nummer ? { ...eintrag, ...teil, vorschlagVonHand: false } : eintrag)),
      ),
    );

  const schalteLeistung = (name: string, prueft: (leistungen: string[]) => boolean) => {
    const an = prueft(haus.leistungen);
    const leistungen = an ? haus.leistungen.filter((eintrag) => !prueft([eintrag])) : [...haus.leistungen, name];
    aendere(index, { leistungen });
  };
  const fuegeMarkeHinzu = () => {
    const text = neueMarke.trim().slice(0, 60);
    if (!text || haus.marken.some((marke) => marke.toLowerCase() === text.toLowerCase())) return setNeueMarke("");
    aendere(index, { marken: [...haus.marken, text] });
    setNeueMarke("");
  };
  const neuesHaus = () => {
    let nummer = standorte.length + 1;
    while (standorte.some((eintrag) => eintrag.name === `Neues Haus ${nummer}`)) nummer += 1;
    const neu: PitchStandort = {
      name: `Neues Haus ${nummer}`,
      adresse: null,
      marken: [],
      leistungen: ["Verkauf"],
      oeffnungszeiten: null,
      campus: null,
      vorschlagText: "",
      vorschlagModule: [],
      vorschlagVonHand: false,
    };
    setStandorte(berechne([...standorte, neu]));
    setGewaehlt(standorte.length);
  };
  const entferne = () => {
    if (standorte.length <= 1) return;
    setStandorte(berechne(standorte.filter((_, i) => i !== index)));
    setGewaehlt(Math.max(0, index - 1));
  };

  return (
    <section className="station">
      <div className="eyebrow">Ihre Standorte</div>
      <h2 style={{ marginTop: 10 }}>Jedes Haus hat einen anderen Alltag</h2>
      <p className="lead">
        Das sind die Häuser, die wir kennen. Ändern Sie, was nicht stimmt: Werkstatt, Marken, Sonntagsöffnung,
        gemeinsamer Standort. Der Vorschlag für das Haus rechnet sofort mit, und alles fließt ins Angebot und in Ihr
        Intranet ein.
      </p>

      <div className="haeuser-leiste">
        <b>
          {standorte.length} {standorte.length === 1 ? "Haus" : "Häuser"}
        </b>
        <button type="button" className="btn" onClick={neuesHaus}>
          Haus hinzufügen
        </button>
        <button
          type="button"
          className="btn"
          disabled={!veraendert}
          onClick={() => {
            setStandorte(ausgang);
            setGewaehlt(0);
          }}
        >
          Zurücksetzen
        </button>
        <span className="hint" aria-live="polite">
          {stand === "speichert"
            ? "Wird gespeichert …"
            : stand === "gespeichert"
              ? "Gespeichert"
              : stand === "fehler"
                ? "Speichern fehlgeschlagen"
                : ""}
        </span>
      </div>

      <div className="cols" style={{ marginTop: 16 }}>
        <div className="grid">
          {standorte.map((standort, nummer) => (
            <button
              key={`${standort.name}-${nummer}`}
              type="button"
              className="card"
              aria-pressed={nummer === index}
              onClick={() => setGewaehlt(nummer)}
            >
              <b>{standort.name || "Ohne Namen"}</b>
              <small>{standort.marken.join(" · ") || "–"}</small>
            </button>
          ))}
        </div>

        {haus ? (
          <aside className="panel detail" aria-live="polite">
            <label className="feld">
              <span>Name des Hauses</span>
              <input
                type="text"
                value={haus.name}
                maxLength={120}
                onChange={(e) => aendere(index, { name: e.target.value })}
              />
            </label>

            <div className="feld">
              <span>Was passiert hier?</span>
              <div className="schalter" role="group" aria-label="Leistungen und Öffnungszeiten">
                {LEISTUNGEN.map((leistung) => (
                  <button
                    key={leistung.name}
                    type="button"
                    className="chip"
                    aria-pressed={leistung.prueft(haus.leistungen)}
                    onClick={() => schalteLeistung(leistung.name, leistung.prueft)}
                  >
                    {leistung.bezeichnung}
                  </button>
                ))}
                <button
                  type="button"
                  className="chip"
                  aria-pressed={istSonntagsgeoeffnet(haus.oeffnungszeiten)}
                  onClick={() =>
                    aendere(index, {
                      oeffnungszeiten: mitSonntag(haus.oeffnungszeiten, !istSonntagsgeoeffnet(haus.oeffnungszeiten)),
                    })
                  }
                >
                  Sonntags geöffnet
                </button>
              </div>
            </div>

            <div className="feld">
              <span>Marken</span>
              <div className="row" style={{ marginBottom: 8 }}>
                {haus.marken.length === 0 ? <span className="hint">Noch keine Marke</span> : null}
                {haus.marken.map((marke) => (
                  <button
                    key={marke}
                    type="button"
                    className="pill p-mute marke-weg"
                    aria-label={`${marke} entfernen`}
                    onClick={() => aendere(index, { marken: haus.marken.filter((eintrag) => eintrag !== marke) })}
                  >
                    {marke} ×
                  </button>
                ))}
              </div>
              <div className="marke-neu">
                <input
                  type="text"
                  value={neueMarke}
                  maxLength={60}
                  placeholder="Marke hinzufügen"
                  aria-label="Marke hinzufügen"
                  onChange={(e) => setNeueMarke(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      fuegeMarkeHinzu();
                    }
                  }}
                />
                <button type="button" className="btn" onClick={fuegeMarkeHinzu}>
                  Hinzufügen
                </button>
              </div>
            </div>

            <label className="feld">
              <span>Gemeinsamer Standort</span>
              <input
                type="text"
                list="verbuende"
                value={haus.campus ?? ""}
                maxLength={80}
                placeholder="z. B. Kokenhorststraße"
                onChange={(e) => aendere(index, { campus: e.target.value.trim() ? e.target.value : null })}
              />
              <datalist id="verbuende">
                {verbuende.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
              <small className="hint">
                Häuser am selben Standort nutzen Räume, Kalender und Verzeichnis gemeinsam.
              </small>
            </label>

            {haus.adresse ? (
              <p className="hint" style={{ margin: "4px 0 0" }}>
                {haus.adresse}
              </p>
            ) : null}

            <div className="fit">
              <span className="eyebrow">Vorschlag für dieses Haus</span>
              <p style={{ margin: "8px 0", color: "var(--muted)" }}>{haus.vorschlagText}</p>
              <div className="row">
                {haus.vorschlagModule.map((key) => (
                  <span key={key} className="pill p-acc">
                    {label(key)}
                    {istBeta(key) ? " (Beta)" : ""}
                  </span>
                ))}
              </div>
            </div>

            <button
              type="button"
              className="btn"
              style={{ marginTop: 16 }}
              disabled={standorte.length <= 1}
              onClick={entferne}
            >
              Haus entfernen
            </button>
          </aside>
        ) : null}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- Funktionen */

function Funktionen({ ansicht }: { ansicht: PitchAnsicht }) {
  const [gruppe, setGruppe] = useState<string>("alle");
  const [gewaehlt, setGewaehlt] = useState<string>("news");
  const [ablauf, setAblauf] = useState<string | null>(null);
  const module = (MODULE_DEFINITIONS as readonly ModuleDefinition[]).filter(
    (modul) => gruppe === "alle" || modul.group === gruppe,
  );
  const aktuell = getModule(gewaehlt);
  const tiers = TIERS.filter((tier) => tier.module.includes(gewaehlt));
  const preis = einzelmodulPreis(gewaehlt);
  const wählbar = waehlbareModule().some((modul) => modul.key === gewaehlt);
  const vorgeschlagen = new Set(ansicht.standorte.flatMap((standort) => standort.vorschlagModule));

  return (
    <section className="station">
      <div className="eyebrow">Funktionsumfang</div>
      <h2 style={{ marginTop: 10 }}>{MODULE_DEFINITIONS.length} Module, Sie schalten ein, was Sie brauchen</h2>
      <p className="lead">
        Wählen Sie ein Modul, um zu sehen, was es tut und in welchem Paket es steckt. Markiert sind die Module, die wir
        für Ihre Häuser vorgeschlagen haben.
      </p>
      <div className="chips" role="group" aria-label="Bereich">
        {[["alle", "Alle"], ...Object.entries(MODULE_GROUP_LABELS)].map(([key, name]) => (
          <button key={key} type="button" className="chip" aria-pressed={gruppe === key} onClick={() => setGruppe(key)}>
            {name}
          </button>
        ))}
      </div>
      <div className="cols">
        <div className="grid">
          {module.map((modul) => (
            <button
              key={modul.key}
              type="button"
              className="card"
              aria-pressed={modul.key === gewaehlt}
              onClick={() => setGewaehlt(modul.key)}
            >
              <b>{modul.label}</b>
              <div className="row">
                {modul.core ? <span className="pill p-mute">Kern</span> : null}
                {modul.stage === "beta" ? <span className="pill p-acc">Beta</span> : null}
                {vorgeschlagen.has(modul.key) ? <span className="pill p-ok">Für Sie vorgeschlagen</span> : null}
              </div>
            </button>
          ))}
        </div>
        {aktuell ? (
          <aside className="panel detail" aria-live="polite">
            <div className="row">
              <span className="pill p-mute">{MODULE_GROUP_LABELS[aktuell.group]}</span>
              {aktuell.stage === "beta" ? (
                <span className="pill p-acc">Beta</span>
              ) : (
                <span className="pill p-ok">Stabil</span>
              )}
            </div>
            <h3>{aktuell.label}</h3>
            <p style={{ margin: 0, color: "var(--muted)" }}>{aktuell.description}</p>
            <dl>
              <dt>Enthalten in</dt>
              <dd>{tiers.map((tier) => tier.name).join(", ")}</dd>
              <dt>Einzeln</dt>
              <dd>
                {aktuell.core
                  ? "Kernmodul, immer enthalten"
                  : wählbar
                    ? `${formatEuro(preis.grundCent)} im Monat plus ${formatEuro(preis.nutzerCent)} je Nutzer`
                    : "Erprobung: nur im Paket Komplett, nach Freischaltung"}
              </dd>
              {aktuell.dependsOn.length > 0 ? (
                <>
                  <dt>Braucht</dt>
                  <dd>{aktuell.dependsOn.map((key) => label(key)).join(", ")}</dd>
                </>
              ) : null}
            </dl>
            <button
              type="button"
              className="btn primary"
              style={{ marginTop: 16 }}
              onClick={() => setAblauf(aktuell.key)}
            >
              Ablauf ansehen
            </button>
          </aside>
        ) : null}
      </div>
      {ablauf ? <ModulSlideshow schluessel={ablauf} onClose={() => setAblauf(null)} /> : null}
    </section>
  );
}

/* ----------------------------------------------------------------- Angebot */

type Speicherstand = "bereit" | "speichert" | "gespeichert" | "fehler";

function Angebot({
  token,
  ansicht,
  konf,
  setKonf,
  nutzlast,
  stand,
}: {
  token: string;
  ansicht: PitchAnsicht;
  konf: LeadKonfiguration;
  setKonf: (aktualisiere: (alt: LeadKonfiguration) => LeadKonfiguration) => void;
  nutzlast: PitchKonfiguration;
  stand: Speicherstand;
}) {
  const [angefragt, setAngefragt] = useState(ansicht.angefragt);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, starte] = useTransition();

  const angebot = useMemo(
    () =>
      berechneAngebot({
        haeuser: konf.haeuser,
        nutzer: konf.nutzer,
        keyUser: konf.keyUser,
        tier: konf.tier as TierKey | null,
        module: konf.module,
      }),
    [konf],
  );

  const aendere = (teil: Partial<LeadKonfiguration>) => setKonf((alt) => ({ ...alt, ...teil }));
  const zahl = (wert: string, min: number, max: number) =>
    Math.min(max, Math.max(min, Math.floor(Number(wert) || min)));

  const waehleTier = (tier: TierKey) => aendere({ tier });
  const waehleAuswahl = () => {
    if (konf.tier === null) return;
    const aktuellesTier = TIERS.find((eintrag) => eintrag.key === konf.tier);
    const start = waehlbareModule()
      .map((modul) => modul.key as string)
      .filter((key) => aktuellesTier?.module.includes(key));
    aendere({ tier: null, module: start });
  };
  const schalte = (key: string) => {
    const hat = angebot.module.includes(key);
    aendere({ module: hat ? konf.module.filter((eintrag) => eintrag !== key) : [...konf.module, key] });
  };

  const anfragen = () => {
    setFehler(null);
    starte(async () => {
      const ergebnis = await pitchAnfrageAction(token, nutzlast);
      if (ergebnis.ok) setAngefragt(true);
      else setFehler(ergebnis.message ?? "Die Anfrage konnte nicht gesendet werden.");
    });
  };

  const stufe = konf.tier === null;

  return (
    <section className="station">
      <div className="eyebrow">Ihr Angebot</div>
      <h2 style={{ marginTop: 10 }}>Stellen Sie sich Ihr Intranet zusammen</h2>
      <p className="lead">
        Alle Preise netto. Ein Paket ist günstiger als dieselben Module einzeln. Ihre Auswahl wird gespeichert, Sie
        können jederzeit zurückkommen.
      </p>

      <div className="inputs">
        <div className="field">
          <label htmlFor="haeuser">Häuser</label>
          <input
            id="haeuser"
            type="number"
            min={1}
            max={HAEUSER_MAX}
            value={konf.haeuser}
            onChange={(e) => aendere({ haeuser: zahl(e.target.value, 1, HAEUSER_MAX) })}
          />
        </div>
        <div className="field">
          <label htmlFor="nutzer">Nutzer mit eigenem Zugang</label>
          <input
            id="nutzer"
            type="number"
            min={1}
            max={NUTZER_MAX}
            value={konf.nutzer}
            onChange={(e) => aendere({ nutzer: zahl(e.target.value, 1, NUTZER_MAX) })}
          />
          <input
            type="range"
            min={1}
            max={1000}
            value={Math.min(konf.nutzer, 1000)}
            aria-label="Nutzer einstellen"
            onChange={(e) => aendere({ nutzer: zahl(e.target.value, 1, 1000) })}
          />
        </div>
        <div className="field">
          <label htmlFor="keyuser">Zu schulende Key-User</label>
          <input
            id="keyuser"
            type="number"
            min={1}
            max={NUTZER_MAX}
            value={angebot.keyUser}
            onChange={(e) => aendere({ keyUser: zahl(e.target.value, 1, NUTZER_MAX) })}
          />
        </div>
      </div>

      <div className="tiers" role="group" aria-label="Paket wählen">
        {TIERS.map((tier) => {
          const rechnung = berechneAngebot({
            haeuser: konf.haeuser,
            nutzer: konf.nutzer,
            keyUser: konf.keyUser,
            tier: tier.key,
          });
          return (
            <button
              key={tier.key}
              type="button"
              className="tier"
              aria-pressed={konf.tier === tier.key}
              onClick={() => waehleTier(tier.key)}
            >
              <h3>{tier.name}</h3>
              <div className="preis">
                {formatEuro(rechnung.monatlich.summeCent)} <small>im Monat</small>
              </div>
              <p>{tier.beschreibung}</p>
              <p>
                <b>{tier.module.length}</b> von {MODULE_DEFINITIONS.length} Modulen
              </p>
              {rechnung.ersparnisCent > 0 ? (
                <span className="spar">{formatEuro(rechnung.ersparnisCent)} günstiger als einzeln</span>
              ) : null}
            </button>
          );
        })}
        <button type="button" className="tier" aria-pressed={stufe} onClick={waehleAuswahl}>
          <h3>Eigene Auswahl</h3>
          <div className="preis">
            {stufe ? formatEuro(angebot.monatlich.summeCent) : "Einzeln"} <small>{stufe ? "im Monat" : "wählen"}</small>
          </div>
          <p>Nur die Module, die Sie wirklich brauchen. Jedes mit eigenem Preis.</p>
        </button>
      </div>

      {stufe ? (
        <>
          <div className="auswahl">
            {waehlbareModule().map((modul) => {
              const an = angebot.module.includes(modul.key);
              const preis = einzelmodulPreis(modul.key);
              return (
                <button
                  key={modul.key}
                  type="button"
                  className="mod"
                  aria-pressed={an}
                  onClick={() => schalte(modul.key)}
                >
                  <span className="box" />
                  <span>
                    <b>{modul.label}</b>
                    <small>{formatEuro(preis.grundCent + preis.nutzerCent * angebot.nutzer)} im Monat</small>
                  </span>
                </button>
              );
            })}
          </div>
          {angebot.empfehlung ? (
            <div className="banner">
              Mit dem Paket „{TIERS.find((tier) => tier.key === angebot.empfehlung?.tier)?.name}“ bekommen Sie mehr
              Module und sparen {formatEuro(angebot.empfehlung.ersparnisCent)} im Monat.{" "}
              <button
                type="button"
                className="btn"
                style={{ marginLeft: 8 }}
                onClick={() => waehleTier(angebot.empfehlung!.tier)}
              >
                Paket nehmen
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      <div className="panel summe">
        <div className="cols" style={{ gridTemplateColumns: "1fr 1fr", alignItems: "start" }}>
          <div>
            <h3 style={{ marginTop: 0 }}>Monatlich</h3>
            <table>
              <tbody>
                {angebot.monatlich.zeilen.map((zeile, index) => (
                  <tr key={`${zeile.text}-${index}`}>
                    <td>{zeile.text}</td>
                    <td>{formatEuro(zeile.cent)}</td>
                  </tr>
                ))}
                <tr className="total">
                  <td>Summe je Monat</td>
                  <td>{formatEuro(angebot.monatlich.summeCent)}</td>
                </tr>
                <tr>
                  <td>Im Jahr</td>
                  <td>{formatEuro(angebot.jahrCent)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div>
            <h3 style={{ marginTop: 0 }}>Einmalig</h3>
            <table>
              <tbody>
                {angebot.einmalig.zeilen.map((zeile, index) => (
                  <tr key={`${zeile.text}-${index}`}>
                    <td>{zeile.text}</td>
                    <td>{formatEuro(zeile.cent)}</td>
                  </tr>
                ))}
                <tr className="total">
                  <td>Summe einmalig</td>
                  <td>{formatEuro(angebot.einmalig.summeCent)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        {angebot.hinweise.map((hinweis) => (
          <p key={hinweis} className="hint" style={{ marginBottom: 0 }}>
            {hinweis}
          </p>
        ))}
        <p className="hint" style={{ marginBottom: 0 }}>
          Richtwert, kein verbindliches Angebot. Einrichtung: Mandant, Rollen, Module, Logo, Standorte und
          Administrationsschulung. Schulung: je 6 Personen ein Termin.
        </p>
      </div>

      <div style={{ marginTop: 20, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" className="btn primary" disabled={laeuft || angefragt} onClick={anfragen}>
          {angefragt ? "Anfrage gesendet" : laeuft ? "Wird gesendet …" : "Unverbindlich anfragen"}
        </button>
        <span className="hint" aria-live="polite">
          {stand === "speichert"
            ? "Wird gespeichert …"
            : stand === "gespeichert"
              ? "Auswahl gespeichert"
              : stand === "fehler"
                ? "Speichern fehlgeschlagen"
                : ""}
        </span>
      </div>
      {angefragt ? (
        <div className="done" role="status">
          Danke, Ihre Anfrage ist bei uns angekommen. Wir melden uns bei Ihnen.
        </div>
      ) : null}
      {fehler ? (
        <div className="err" role="alert">
          {fehler}
        </div>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------- Alltag */

/**
 * Schlussseite: wie AHOI die Fälle von der Eröffnungsseite löst.
 *
 * Zu den ersten sechs Fragen läuft je eine kurze Ablaufanimation, nacheinander
 * und von selbst; Weiter, Zurück und die Auswahl der Fälle greifen jederzeit ein.
 * Dazu steht, ob die Module, die ein Fall braucht, in der gewählten Auswahl
 * stecken: so sieht der Interessent, was seine Wahl im Alltag bringt und was
 * fehlt. Gerechnet wird mit derselben Auswahl wie im Angebot.
 */
function Alltag({ konf, onAngebot }: { konf: LeadKonfiguration; onAngebot: () => void }) {
  const angebot = berechneAngebot({
    haeuser: konf.haeuser,
    nutzer: konf.nutzer,
    keyUser: konf.keyUser,
    tier: konf.tier as TierKey | null,
    module: konf.module,
  });
  const gewaehlt = new Set(angebot.module);
  const [fall, setFall] = useState(0);
  const [schritt, setSchritt] = useState(0);
  const [spielt, setSpielt] = useState(true);

  const aktuell = PITCH_FAELLE[fall];
  const letzterSchritt = aktuell.szene.schritte.length - 1;
  const letzterFall = PITCH_FAELLE.length - 1;
  const ende = fall === letzterFall && schritt === letzterSchritt;
  const fehlend = (f: (typeof PITCH_FAELLE)[number]) => f.module.filter((key) => !gewaehlt.has(key));
  const abgedeckt = PITCH_FAELLE.filter((f) => fehlend(f).length === 0).length;

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setSpielt(false);
  }, []);

  const weiter = () => {
    if (schritt < letzterSchritt) setSchritt(schritt + 1);
    else if (fall < letzterFall) {
      setFall(fall + 1);
      setSchritt(0);
    }
  };
  const zurueck = () => {
    if (schritt > 0) setSchritt(schritt - 1);
    else if (fall > 0) {
      setFall(fall - 1);
      setSchritt(PITCH_FAELLE[fall - 1].szene.schritte.length - 1);
    }
  };

  // Läuft von selbst: kurz je Schritt, etwas länger beim Wechsel zum nächsten Fall.
  useEffect(() => {
    if (!spielt) return;
    if (ende) {
      setSpielt(false);
      return;
    }
    const timer = window.setTimeout(weiter, schritt === letzterSchritt ? 3400 : 3000);
    return () => window.clearTimeout(timer);
  }, [spielt, fall, schritt]);

  const fehlt = fehlend(aktuell);

  return (
    <section className="station">
      <div className="eyebrow">Ihr Alltag mit AHOI</div>
      <h2 style={{ marginTop: 10 }}>So lösen Sie das</h2>
      <p className="lead">
        Die Fälle vom Anfang, jetzt mit Lösung. Mit Ihrer Auswahl gehen{" "}
        <b>
          {abgedeckt} von {PITCH_FAELLE.length}
        </b>{" "}
        ganz auf.
      </p>

      <div className="chips fall-wahl" role="group" aria-label="Fall wählen">
        {PITCH_FAELLE.map((f, index) => (
          <button
            key={f.key}
            type="button"
            className="chip"
            aria-pressed={index === fall}
            onClick={() => {
              setFall(index);
              setSchritt(0);
            }}
          >
            {index + 1} · {f.kurz}
            {fehlend(f).length === 0 ? " ✓" : ""}
          </button>
        ))}
      </div>

      <div className="fall-karte" key={fall}>
        {aktuell.frage}
      </div>

      <div className="buehne" style={{ marginTop: 14 }}>
        <Buehne szene={aktuell.szene} schritt={schritt} titel={aktuell.frage} />
      </div>

      <div className="untertitel" aria-live="polite">
        <h3>{aktuell.szene.schritte[schritt].titel}</h3>
        <p>{aktuell.szene.schritte[schritt].text}</p>
      </div>

      <div className="fall-auswahl" aria-live="polite">
        {aktuell.module.map((key) => (
          <span key={key} className={`pill ${gewaehlt.has(key) ? "p-ok" : "p-wait"}`}>
            {label(key)}: {gewaehlt.has(key) ? "in Ihrer Auswahl" : "nicht in Ihrer Auswahl"}
          </span>
        ))}
        {fehlt.length > 0 ? (
          <button type="button" className="btn" onClick={onAngebot}>
            Im Angebot ändern
          </button>
        ) : null}
      </div>

      <div className="steuerung">
        <button type="button" className="btn" disabled={fall === 0 && schritt === 0} onClick={zurueck}>
          Zurück
        </button>
        <div className="punkte" role="group" aria-label="Schritte">
          {aktuell.szene.schritte.map((s, index) => (
            <button
              key={s.titel}
              type="button"
              className={`punkt ${index === schritt ? "an" : index < schritt ? "vorbei" : ""}`}
              aria-label={`Schritt ${index + 1}: ${s.titel}`}
              aria-current={index === schritt}
              onClick={() => setSchritt(index)}
            />
          ))}
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => {
            if (!spielt && ende) {
              setFall(0);
              setSchritt(0);
            }
            setSpielt(!spielt);
          }}
        >
          {spielt ? "Pause" : ende ? "Nochmal" : "Abspielen"}
        </button>
        <button type="button" className="btn primary" disabled={ende} onClick={weiter}>
          Weiter
        </button>
      </div>

      {ende ? (
        <div className="fall-schluss">
          <p>
            Mit Ihrer Auswahl gehen {abgedeckt} von {PITCH_FAELLE.length} Fällen ganz auf.
            {abgedeckt < PITCH_FAELLE.length ? " Was fehlt, lässt sich im Angebot ergänzen." : ""}
          </p>
          <button type="button" className="btn primary" onClick={onAngebot}>
            Zum Angebot
          </button>
        </div>
      ) : null}
    </section>
  );
}
