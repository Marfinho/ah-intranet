import type { Szene } from "./pitch-szenen";

/**
 * Die ersten sechs Fragen der Eröffnungsseite, jetzt mit Lösung: eine kurze
 * Ablaufanimation, was in AHOI passiert. Jeder Fall nennt die Module, die er
 * braucht; die Seite sagt dazu, ob sie in der gewählten Auswahl stecken.
 *
 * Die Fragen stehen in derselben Reihenfolge und mit demselben Wortlaut wie auf
 * der Eröffnungsseite (`LANGSAM` und die ersten Einträge von `SCHNELL` in
 * `pitch.tsx`). Jede Aussage gilt für das System, wie es ist.
 */
export interface PitchFall {
  key: string;
  /** Kurzform für die Auswahl. */
  kurz: string;
  frage: string;
  /** Module, ohne die der Fall nicht aufgeht (Kernmodule stehen nicht dabei). */
  module: string[];
  szene: Szene;
}

const AUS = { sichtbar: false } as const;

export const PITCH_FAELLE: readonly PitchFall[] = [
  {
    key: "urlaub",
    kurz: "Urlaub",
    frage: "Fr. Müller braucht Urlaub",
    module: ["absences"],
    szene: {
      figuren: [
        { id: "ma", art: "person", label: "Fr. Müller" },
        { id: "kal", art: "kalender", label: "Urlaub" },
        { id: "leitung", art: "person", label: "Führungskraft" },
        { id: "glocke", art: "glocke" },
      ],
      schritte: [
        {
          titel: "Antrag im Intranet",
          text: "Fr. Müller trägt ihren Urlaub ein. Kein Zettel, kein Hinterhertelefonieren.",
          zustand: {
            ma: { x: 130, y: 225 },
            kal: { x: 330, y: 165, werte: [8, 9, 10], abzeichen: "uhr", rand: "wartet" },
            leitung: { x: 670, y: 225 },
            glocke: { x: 520, y: 150, ...AUS },
          },
        },
        {
          titel: "Die Führungskraft entscheidet",
          text: "Sie bekommt eine Meldung, sieht den Antrag und entscheidet am Bildschirm.",
          zustand: { glocke: { sichtbar: true, x: 560, y: 150, rand: "akzent" }, leitung: { rand: "akzent" } },
        },
        {
          titel: "Entschieden",
          text: "Die Antwort kommt bei Fr. Müller an, auch per Mail, wenn der Versand eingerichtet ist.",
          zustand: {
            kal: { abzeichen: "haken", rand: "ok" },
            glocke: { x: 230, y: 150 },
            leitung: { rand: null },
            ma: { abzeichen: "haken" },
          },
        },
      ],
    },
  },
  {
    key: "telefonnummer",
    kurz: "Telefonnummer",
    frage: "Hr. Kopernikus sucht die Telefonnummer von Fr. Hülse im anderen Standort",
    module: ["directory"],
    szene: {
      figuren: [
        { id: "kop", art: "person", label: "Hr. Kopernikus" },
        { id: "lupe", art: "lupe" },
        { id: "k1", art: "karte", label: "Hr. Aydin" },
        { id: "k2", art: "karte", label: "Fr. Hülse" },
        { id: "k3", art: "karte", label: "Hr. Brandt" },
      ],
      schritte: [
        {
          titel: "Suchen",
          text: "Hr. Kopernikus sucht im Verzeichnis nach dem Namen. Er muss nicht wissen, wer im anderen Haus sitzt.",
          zustand: {
            kop: { x: 130, y: 225, abzeichen: "frage" },
            lupe: { x: 270, y: 150 },
            k1: { x: 460, y: 150, ...AUS },
            k2: { x: 580, y: 150, ...AUS },
            k3: { x: 700, y: 150, ...AUS },
          },
        },
        {
          titel: "Das Verzeichnis kennt alle Häuser",
          text: "Telefonbuch mit Standort, Abteilung, Zuständigkeit und Anwesenheit, an einer Stelle gepflegt.",
          zustand: { lupe: { rand: "akzent" }, k1: { sichtbar: true }, k2: { sichtbar: true }, k3: { sichtbar: true } },
        },
        {
          titel: "Gefunden",
          text: "Die Karte von Fr. Hülse zeigt ihre Nummer. Herumfragen entfällt.",
          zustand: {
            k2: { rand: "ok", abzeichen: "haken" },
            k1: { gedimmt: true },
            k3: { gedimmt: true },
            kop: { abzeichen: null },
          },
        },
      ],
    },
  },
  {
    key: "meetingraum",
    kurz: "Meetingraum",
    frage: "Hr. Meyer braucht einen Raum für ein Meeting",
    module: ["rooms"],
    szene: {
      figuren: [
        { id: "meyer", art: "person", label: "Hr. Meyer" },
        { id: "r1", art: "raum", label: "Besprechung" },
        { id: "r2", art: "raum", label: "Schulung" },
        { id: "kollege", art: "person", label: "Kollegin" },
      ],
      schritte: [
        {
          titel: "Raum suchen",
          text: "Hr. Meyer sieht, welche Räume am Dienstagvormittag frei sind, auch in anderen Häusern.",
          zustand: {
            meyer: { x: 130, y: 225 },
            r1: { x: 360, y: 170 },
            r2: { x: 560, y: 170, rand: "wartet", abzeichen: "uhr" },
            kollege: { x: 690, y: 235, ...AUS },
          },
        },
        {
          titel: "Buchen",
          text: "Ein Klick, der Raum ist gebucht und für alle sichtbar belegt.",
          zustand: { r1: { rand: "ok", abzeichen: "haken" }, meyer: { abzeichen: "haken" } },
        },
        {
          titel: "Keine Doppelbuchung",
          text: "Will eine Kollegin denselben Raum zur selben Zeit, wird die Buchung abgewiesen.",
          zustand: { kollege: { sichtbar: true, x: 470, y: 235, abzeichen: "frage" }, r1: { rand: "wartet" } },
        },
      ],
    },
  },
  {
    key: "neue-marke",
    kurz: "Neue Marke",
    frage: "Eine neue Marke zieht ein: wer sieht was?",
    module: ["news"],
    szene: {
      figuren: [
        { id: "admin", art: "person", label: "Administration" },
        { id: "marke", art: "kachel", label: "Neue Marke" },
        { id: "rolle", art: "kachel", label: "Rolle Verkauf" },
        { id: "neu", art: "haus", label: "Neuer Standort" },
        { id: "alt", art: "haus", label: "Anderes Haus" },
        { id: "aushang", art: "dokument", label: "Aushang" },
      ],
      schritte: [
        {
          titel: "Marke und Standort anlegen",
          text: "Die Administration legt Marke und Standort im Intranet an und weist sie zu.",
          zustand: {
            admin: { x: 120, y: 225 },
            marke: { x: 290, y: 130 },
            rolle: { x: 290, y: 215, ...AUS },
            neu: { x: 560, y: 215 },
            alt: { x: 690, y: 215 },
            aushang: { x: 430, y: 120, ...AUS },
          },
        },
        {
          titel: "Rollen mit eigenen Rechten",
          text: "Jedes Haus legt Rollen an und vergibt genau die Rechte, die sie brauchen.",
          zustand: { rolle: { sichtbar: true, rand: "akzent" }, marke: { rand: "ok" }, neu: { rand: "akzent" } },
        },
        {
          titel: "Nur der Standort sieht es",
          text: "Aushänge und Dokumente gehen nach Zielgruppe: der neue Standort bekommt sie, das andere Haus nicht.",
          zustand: { aushang: { sichtbar: true, x: 560, y: 120 }, alt: { gedimmt: true } },
        },
      ],
    },
  },
  {
    key: "neue-regel",
    kurz: "Neue Regel",
    frage: "Die neue Regel zur Fahrzeugübergabe muss alle erreichen",
    module: ["news"],
    szene: {
      figuren: [
        { id: "zentrale", art: "person", label: "Zentrale" },
        { id: "regel", art: "dokument", label: "Neue Regel" },
        { id: "k1", art: "dokument" },
        { id: "k2", art: "dokument" },
        { id: "k3", art: "dokument" },
        { id: "h1", art: "haus", label: "Haus Nord" },
        { id: "h2", art: "haus", label: "Haus Süd" },
        { id: "h3", art: "haus", label: "Haus West" },
      ],
      schritte: [
        {
          titel: "Aushang schreiben",
          text: "Die Zentrale schreibt die Regel als Aushang, mit Priorität und Anhang.",
          zustand: {
            zentrale: { x: 120, y: 215 },
            regel: { x: 250, y: 175 },
            k1: { x: 250, y: 175, ...AUS },
            k2: { x: 250, y: 175, ...AUS },
            k3: { x: 250, y: 175, ...AUS },
            h1: { x: 470, y: 215 },
            h2: { x: 580, y: 215 },
            h3: { x: 690, y: 215 },
          },
        },
        {
          titel: "An alle Häuser",
          text: "Mit einem Klick geht sie an alle Standorte, ohne Rundmail und ohne Zettel am Schwarzen Brett.",
          zustand: {
            k1: { sichtbar: true, x: 470, y: 130 },
            k2: { sichtbar: true, x: 580, y: 130 },
            k3: { sichtbar: true, x: 690, y: 130 },
            h1: { rand: "akzent" },
            h2: { rand: "akzent" },
            h3: { rand: "akzent" },
          },
        },
        {
          titel: "Wer hat es gelesen?",
          text: "Die Lesebestätigung zeigt, welches Haus bestätigt hat und welches noch nicht.",
          zustand: { h1: { abzeichen: "haken" }, h2: { abzeichen: "haken" }, h3: { abzeichen: "uhr" } },
        },
      ],
    },
  },
  {
    key: "gemeinsamer-standort",
    kurz: "Gemeinsamer Standort",
    frage: "Zwei Häuser am selben Standort teilen sich Räume und Termine",
    module: ["rooms", "calendar"],
    szene: {
      figuren: [
        { id: "standort", art: "kasten", label: "Ein Standort" },
        { id: "h1", art: "haus", label: "Haus A" },
        { id: "h2", art: "haus", label: "Haus B" },
        { id: "raum", art: "raum", label: "Schulungsraum" },
        { id: "kal", art: "kalender", label: "Termine" },
      ],
      schritte: [
        {
          titel: "Zwei Häuser, ein Standort",
          text: "Beide Häuser arbeiten getrennt, brauchen aber dieselben Räume.",
          zustand: {
            standort: { x: 270, y: 195 },
            h1: { x: 215, y: 195 },
            h2: { x: 325, y: 195 },
            raum: { x: 520, y: 170, ...AUS },
            kal: { x: 670, y: 170, werte: [], ...AUS },
          },
        },
        {
          titel: "Ein gemeinsamer Raum",
          text: "Der Raum ist standortübergreifend buchbar. Wer ihn bucht, sperrt ihn für den anderen.",
          zustand: { raum: { sichtbar: true, rand: "ok" }, h1: { abzeichen: "haken" }, h2: { abzeichen: "haken" } },
        },
        {
          titel: "Ein gemeinsamer Kalender",
          text: "Termine zeigen sich den Häusern, die sie betreffen. Die Schulung steht dort, wo sie jeder findet.",
          zustand: { kal: { sichtbar: true, werte: [9, 10, 16], rand: "ok" } },
        },
      ],
    },
  },
];
