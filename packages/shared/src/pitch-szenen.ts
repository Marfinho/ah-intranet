/**
 * Szenen der Modul-Slideshow auf der Pitch-Seite.
 *
 * Eine Szene ist eine Liste von Figuren und eine Folge von Schritten. Jeder
 * Schritt nennt nur, was sich ändert; alles andere bleibt, wie es war. Die
 * Bewegung zwischen den Schritten übernimmt die Darstellung - ein Modul lässt
 * sich so als Daten erzählen, ohne eine eigene Animation zu bauen.
 *
 * Jede Aussage in den Texten gilt für das System, wie es ist. Ein Test hält die
 * Szenen an der Modulregistry: kein Modul ohne Szene, keine Figur ohne Platz.
 */

export const FIGUR_ARTEN = [
  "person",
  "haus",
  "dokument",
  "kasten",
  "schicht",
  "kachel",
  "karte",
  "kalender",
  "balken",
  "checkliste",
  "glocke",
  "lupe",
  "gluehbirne",
  "buch",
  "schluessel",
  "teller",
  "zahnrad",
  "ticket",
  "raum",
] as const;
export type FigurArt = (typeof FIGUR_ARTEN)[number];

export type SzenenAbzeichen = "haken" | "uhr" | "frage" | null;
export type SzenenRand = "akzent" | "ok" | "wartet" | null;

export interface SzenenFigur {
  id: string;
  art: FigurArt;
  label?: string;
}

export interface SzenenZustand {
  x?: number;
  y?: number;
  sichtbar?: boolean;
  gedimmt?: boolean;
  rand?: SzenenRand;
  abzeichen?: SzenenAbzeichen;
  /** Überschreibt die Beschriftung ab diesem Schritt, leer blendet sie aus. */
  label?: string;
  /** Für Balken (Höhen 0 bis 1), Checkliste (0/1 je Zeile) und Kalender (markierte Tage). */
  werte?: number[];
}

export interface SzenenSchritt {
  titel: string;
  text: string;
  zustand: Record<string, SzenenZustand>;
}

export interface Szene {
  figuren: SzenenFigur[];
  schritte: SzenenSchritt[];
}

export const SZENE_BREITE = 800;
export const SZENE_HOEHE = 340;

const AUS = { sichtbar: false } as const;

export const MODUL_SZENEN: Readonly<Record<string, Szene>> = {
  dashboard: {
    figuren: [
      { id: "sie", art: "person", label: "Sie" },
      { id: "k1", art: "kachel", label: "Aushänge" },
      { id: "k2", art: "kachel", label: "Freigaben" },
      { id: "k3", art: "kachel", label: "Termine" },
      { id: "k4", art: "kachel", label: "Anderes Haus" },
    ],
    schritte: [
      {
        titel: "Anmelden",
        text: "Beim Anmelden landen Sie auf Ihrer Startseite. Kein Menü, durch das Sie sich suchen müssen.",
        zustand: {
          sie: { x: 140, y: 215 },
          k1: { x: 400, y: 130, ...AUS },
          k2: { x: 520, y: 130, ...AUS },
          k3: { x: 400, y: 215, ...AUS },
          k4: { x: 520, y: 215, ...AUS },
        },
      },
      {
        titel: "Alles Wichtige",
        text: "Neue Aushänge, offene Freigaben und heutige Termine auf einen Blick.",
        zustand: {
          k1: { sichtbar: true },
          k2: { sichtbar: true, abzeichen: "uhr" },
          k3: { sichtbar: true },
        },
      },
      {
        titel: "Nur, was für Sie gilt",
        text: "Jede Person sieht, was für ihr Haus und ihre Abteilung gilt. Was nur ein anderes Haus betrifft, bleibt außen vor.",
        zustand: {
          k1: { rand: "akzent" },
          k2: { rand: "akzent" },
          k3: { rand: "akzent" },
          k4: { sichtbar: true, gedimmt: true },
        },
      },
    ],
  },

  search: {
    figuren: [
      { id: "sie", art: "person", label: "Sie" },
      { id: "lupe", art: "lupe" },
      { id: "d1", art: "dokument", label: "Aushang" },
      { id: "d2", art: "dokument", label: "Dokument" },
      { id: "d3", art: "dokument", label: "Wissen" },
      { id: "d4", art: "dokument", label: "Fremdes Haus" },
    ],
    schritte: [
      {
        titel: "Ein Suchfeld",
        text: "Ein Suchfeld für Aushänge, Dokumente, Wissensseiten, Kolleginnen und Tickets.",
        zustand: {
          sie: { x: 130, y: 215 },
          lupe: { x: 270, y: 150 },
          d1: { x: 450, y: 130, ...AUS },
          d2: { x: 555, y: 200, ...AUS },
          d3: { x: 660, y: 130, ...AUS },
          d4: { x: 660, y: 235, ...AUS },
        },
      },
      {
        titel: "Alles auf einmal",
        text: "Die Preisliste vom letzten Jahr finden, ohne zu wissen, in welchem Ordner sie liegt.",
        zustand: {
          lupe: { rand: "akzent" },
          d1: { sichtbar: true, rand: "akzent" },
          d2: { sichtbar: true, rand: "akzent" },
          d3: { sichtbar: true, rand: "akzent" },
        },
      },
      {
        titel: "Nicht für alle",
        text: "Aushänge und Dokumente erscheinen nur für ihre Zielgruppe. Was für ein anderes Haus bestimmt ist, taucht bei Ihnen nicht auf.",
        zustand: { d4: { sichtbar: true, gedimmt: true } },
      },
    ],
  },

  notifications: {
    figuren: [
      { id: "leitung", art: "person", label: "Leitung" },
      { id: "antrag", art: "dokument", label: "Urlaubsantrag" },
      { id: "glocke", art: "glocke" },
      { id: "mail", art: "dokument", label: "E-Mail" },
      { id: "ma", art: "person", label: "Antragstellerin" },
    ],
    schritte: [
      {
        titel: "Entscheidung",
        text: "Die Leitung entscheidet über einen Urlaubsantrag.",
        zustand: {
          leitung: { x: 130, y: 220 },
          antrag: { x: 280, y: 180, abzeichen: "haken", rand: "ok" },
          glocke: { x: 440, y: 140, ...AUS },
          mail: { x: 590, y: 120, ...AUS },
          ma: { x: 680, y: 220 },
        },
      },
      {
        titel: "Meldung im Intranet",
        text: "Die Antragstellerin bekommt sofort eine Meldung. Sie muss nicht nachfragen und nicht auf einen Zettel warten.",
        zustand: { glocke: { sichtbar: true, x: 560, y: 150, rand: "akzent" } },
      },
      {
        titel: "Auch per Mail",
        text: "Entscheidungen über Anträge gehen zusätzlich per Mail raus, wenn der Mailversand eingerichtet ist. Ein neuer Aushang nicht, damit Mails wichtig bleiben.",
        zustand: { glocke: { x: 680, y: 125 }, mail: { sichtbar: true, x: 560, y: 150 } },
      },
    ],
  },

  quicklinks: {
    figuren: [
      { id: "sie", art: "person", label: "Sie" },
      { id: "k1", art: "kachel", label: "DMS" },
      { id: "k2", art: "kachel", label: "Zeiten" },
      { id: "k3", art: "kachel", label: "Hersteller" },
      { id: "dms", art: "kasten", label: "Ihr DMS" },
    ],
    schritte: [
      {
        titel: "Kacheln auf der Startseite",
        text: "Die Fachanwendungen Ihres Hauses liegen als Kacheln bereit: DMS, Zeiterfassung, Herstellerportale.",
        zustand: {
          sie: { x: 130, y: 215 },
          k1: { x: 300, y: 130, ...AUS },
          k2: { x: 410, y: 130, ...AUS },
          k3: { x: 520, y: 130, ...AUS },
          dms: { x: 660, y: 205, ...AUS },
        },
      },
      {
        titel: "Alles an einem Ort",
        text: "Neue Kolleginnen finden die wichtigen Systeme am ersten Tag, ohne zu fragen, wo sie liegen.",
        zustand: { k1: { sichtbar: true }, k2: { sichtbar: true }, k3: { sichtbar: true } },
      },
      {
        titel: "Es führt hin, es ersetzt nichts",
        text: "Ein Klick öffnet die Anwendung. Das Intranet ersetzt kein DMS, es führt dorthin.",
        zustand: { k1: { rand: "akzent" }, dms: { sichtbar: true, rand: "ok" } },
      },
    ],
  },

  news: {
    figuren: [
      { id: "zentrale", art: "person", label: "Zentrale" },
      { id: "beitrag", art: "dokument", label: "Aushang" },
      { id: "k1", art: "dokument" },
      { id: "k2", art: "dokument" },
      { id: "k3", art: "dokument" },
      { id: "h1", art: "haus", label: "Haus Nord" },
      { id: "h2", art: "haus", label: "Haus Süd" },
      { id: "h3", art: "haus", label: "Haus Ost" },
      { id: "h4", art: "haus", label: "Haus West" },
    ],
    schritte: [
      {
        titel: "Beitrag verfassen",
        text: "Die Zentrale schreibt einen Aushang, etwa die neue Regel zur Fahrzeugübergabe. Mit Priorität, Anhang und Kommentarfunktion.",
        zustand: {
          zentrale: { x: 120, y: 210 },
          beitrag: { x: 230, y: 175 },
          k1: { x: 230, y: 175, ...AUS },
          k2: { x: 230, y: 175, ...AUS },
          k3: { x: 230, y: 175, ...AUS },
          h1: { x: 440, y: 215, ...AUS },
          h2: { x: 530, y: 215, ...AUS },
          h3: { x: 620, y: 215, ...AUS },
          h4: { x: 710, y: 215, ...AUS },
        },
      },
      {
        titel: "Zielgruppe wählen",
        text: "Der Aushang geht nur an die Häuser, für die er gilt. Haus West betrifft er nicht.",
        zustand: {
          h1: { sichtbar: true, rand: "akzent" },
          h2: { sichtbar: true, rand: "akzent" },
          h3: { sichtbar: true, rand: "akzent" },
          h4: { sichtbar: true, gedimmt: true },
        },
      },
      {
        titel: "Veröffentlichen",
        text: "Mit einem Klick erreicht der Beitrag alle gewählten Häuser. Kein Rundmail-Verteiler, kein Zettel am Schwarzen Brett.",
        zustand: {
          k1: { sichtbar: true, x: 440, y: 130 },
          k2: { sichtbar: true, x: 530, y: 130 },
          k3: { sichtbar: true, x: 620, y: 130 },
        },
      },
      {
        titel: "Gelesen?",
        text: "Bei wichtigen Beiträgen sieht die Zentrale, wer ihn bestätigt hat und wer noch nicht. Lesebestätigungen werden nach 180 Tagen gelöscht.",
        zustand: { h1: { abzeichen: "haken" }, h2: { abzeichen: "haken" }, h3: { abzeichen: "uhr" } },
      },
    ],
  },

  directory: {
    figuren: [
      { id: "sie", art: "person", label: "Sie" },
      { id: "k1", art: "karte", label: "Service" },
      { id: "k2", art: "karte", label: "Teiledienst" },
      { id: "k3", art: "karte", label: "Zulassung" },
    ],
    schritte: [
      {
        titel: "Wer macht eigentlich …?",
        text: "Wer ist für die Zulassung zuständig, und ist die Person heute da? Früher hieß das: herumfragen.",
        zustand: {
          sie: { x: 130, y: 215, abzeichen: "frage" },
          k1: { x: 340, y: 150, ...AUS },
          k2: { x: 470, y: 150, ...AUS },
          k3: { x: 600, y: 150, ...AUS },
        },
      },
      {
        titel: "Das Verzeichnis",
        text: "Telefonbuch aller Häuser mit Standort, Abteilung und Zuständigkeit. An einer Stelle gepflegt, nicht in einer Liste je Haus.",
        zustand: { k1: { sichtbar: true }, k2: { sichtbar: true }, k3: { sichtbar: true } },
      },
      {
        titel: "Gefunden",
        text: "Die Karte zeigt die Zuständigkeit und die Anwesenheit. Die Antwort steht da, bevor jemand zum Hörer greift.",
        zustand: {
          k3: { rand: "ok", abzeichen: "haken" },
          sie: { abzeichen: null },
          k1: { gedimmt: true },
          k2: { gedimmt: true },
        },
      },
    ],
  },

  polls: {
    figuren: [
      { id: "zentrale", art: "person", label: "Zentrale" },
      { id: "umfrage", art: "balken", label: "Betriebsfeier" },
    ],
    schritte: [
      {
        titel: "Eine Frage an alle",
        text: "Die Zentrale legt eine Kurzumfrage an, etwa zum Termin der Betriebsfeier, und schickt sie an alle Häuser.",
        zustand: { zentrale: { x: 150, y: 215 }, umfrage: { x: 470, y: 190, werte: [0, 0, 0] } },
      },
      {
        titel: "Antworten kommen",
        text: "Die Stimmen laufen ein, die Auswertung wächst mit.",
        zustand: { umfrage: { werte: [0.35, 0.6, 0.2], abzeichen: "uhr" } },
      },
      {
        titel: "Ergebnis",
        text: "Das Ergebnis steht in Echtzeit da. Wichtig: Umfragen sind nicht anonym, auch wenn es so aussieht. Das steht ausdrücklich in der Dokumentation.",
        zustand: { umfrage: { werte: [0.4, 0.95, 0.3], abzeichen: "haken", rand: "ok" } },
      },
    ],
  },

  ideas: {
    figuren: [
      { id: "ma", art: "person", label: "Werkstatt" },
      { id: "idee", art: "gluehbirne" },
      { id: "leitung", art: "person", label: "Leitung" },
    ],
    schritte: [
      {
        titel: "Eine Idee",
        text: "Jemand aus der Werkstatt hat einen Verbesserungsvorschlag und reicht ihn im Intranet ein.",
        zustand: { ma: { x: 130, y: 220 }, idee: { x: 250, y: 150 }, leitung: { x: 660, y: 220, ...AUS } },
      },
      {
        titel: "Bewertung",
        text: "Die Leitung sieht die Idee und bewertet sie. Der Bearbeitungsstand ist für alle sichtbar, nichts verschwindet im Postfach.",
        zustand: { leitung: { sichtbar: true }, idee: { x: 540, y: 150, abzeichen: "uhr", rand: "wartet" } },
      },
      {
        titel: "Umgesetzt",
        text: "Wird die Idee umgesetzt, sehen es alle. Gute Ideen aus einem Haus kommen in den anderen an.",
        zustand: { idee: { abzeichen: "haken", rand: "ok" }, ma: { abzeichen: "haken" } },
      },
    ],
  },

  documents: {
    figuren: [
      { id: "zentrale", art: "person", label: "Zentrale" },
      { id: "doc", art: "dokument", label: "Formular" },
      { id: "h1", art: "haus", label: "Haus Nord" },
      { id: "h2", art: "haus", label: "Haus Süd" },
      { id: "h3", art: "haus", label: "Haus West" },
    ],
    schritte: [
      {
        titel: "Dokument einstellen",
        text: "Formulare, Vorlagen und Richtlinien liegen an einer Stelle, mit Kategorie. Eingestellt werden sie von Personen mit dem Recht dazu.",
        zustand: {
          zentrale: { x: 130, y: 215 },
          doc: { x: 270, y: 175 },
          h1: { x: 480, y: 215, ...AUS },
          h2: { x: 580, y: 215, ...AUS },
          h3: { x: 680, y: 215, ...AUS },
        },
      },
      {
        titel: "Für wen?",
        text: "Jedes Dokument hat eine Zielgruppe. Das Formular für die Werkstatt liegt nur dort, wo es gebraucht wird.",
        zustand: {
          h1: { sichtbar: true, rand: "akzent" },
          h2: { sichtbar: true, rand: "akzent" },
          h3: { sichtbar: true, gedimmt: true },
        },
      },
      {
        titel: "Zurückziehen statt verteilen",
        text: "Ein Dokument wird eingestellt und bei Bedarf zurückgezogen. Es muss nicht per Mail herumgeschickt werden und taucht in alten Postfächern nicht wieder auf.",
        zustand: { doc: { x: 480, y: 135, rand: "ok" }, zentrale: { abzeichen: "haken" } },
      },
    ],
  },

  wiki: {
    figuren: [
      { id: "experte", art: "person", label: "Fachperson" },
      { id: "buch", art: "buch", label: "Wissen" },
      { id: "s1", art: "dokument", label: "Übergabe" },
      { id: "s2", art: "dokument", label: "Garantie" },
      { id: "neu", art: "person", label: "Neu im Haus" },
    ],
    schritte: [
      {
        titel: "Wissen aufschreiben",
        text: "Eine Fachperson schreibt auf, wie die Fahrzeugübergabe abläuft, statt es jedes Mal zu erklären.",
        zustand: {
          experte: { x: 130, y: 220 },
          buch: { x: 400, y: 190 },
          s1: { x: 270, y: 170, rand: "akzent" },
          s2: { x: 400, y: 100, ...AUS },
          neu: { x: 680, y: 220, ...AUS },
        },
      },
      {
        titel: "Eine Sammlung entsteht",
        text: "Anleitungen für Garantieabwicklung, Probefahrt oder die Standards einer neuen Marke wachsen zu einem durchsuchbaren Wiki.",
        zustand: { s1: { x: 360, y: 100, rand: null }, s2: { sichtbar: true, x: 440, y: 100 } },
      },
      {
        titel: "Nachlesen statt nachfragen",
        text: "Wer neu ist, schlägt nach, statt eine Kollegin von der Arbeit abzuhalten.",
        zustand: { neu: { sichtbar: true, abzeichen: "haken" }, s2: { x: 640, y: 140, rand: "ok" } },
      },
    ],
  },

  orders: {
    figuren: [
      { id: "ma", art: "person", label: "Mitarbeiter" },
      { id: "best", art: "dokument", label: "Bestellung" },
      { id: "d2", art: "dokument" },
      { id: "d3", art: "dokument" },
      { id: "sammel", art: "kasten", label: "Sammelbestellung" },
      { id: "termin", art: "kalender", label: "Stichtag" },
    ],
    schritte: [
      {
        titel: "Bestellen",
        text: "Visitenkarten oder Arbeitskleidung bestellt man im Intranet, mit den Größen und Angaben, die der Katalog verlangt. Kein Zettel, keine Rückfrage.",
        zustand: {
          ma: { x: 120, y: 220 },
          best: { x: 250, y: 185 },
          d2: { x: 560, y: 200, ...AUS },
          d3: { x: 590, y: 210, ...AUS },
          sammel: { x: 580, y: 195, ...AUS },
          termin: { x: 460, y: 110, werte: [], ...AUS },
        },
      },
      {
        titel: "Stand im Blick",
        text: "Jede Bestellung zeigt ihren Stand, vom Antrag bis zur Lieferung. Nachfragen erübrigen sich.",
        zustand: { best: { abzeichen: "uhr", rand: "wartet", x: 330 } },
      },
      {
        titel: "Gebündelt bestellen",
        text: "Freigegebene Bestellungen aller Häuser gehen zu festen Terminen gebündelt an den Dienstleister. Zehn Jahre bleiben sie aufbewahrt, weil das Steuerrecht es verlangt.",
        zustand: {
          best: { x: 560, y: 185, abzeichen: "haken", rand: "ok", label: "" },
          sammel: { sichtbar: true },
          d2: { sichtbar: true, x: 590, y: 190 },
          d3: { sichtbar: true, x: 620, y: 200 },
          termin: { sichtbar: true, x: 700, y: 110, werte: [10] },
        },
      },
    ],
  },

  approvals: {
    figuren: [
      { id: "ma", art: "person", label: "Werkstatt" },
      { id: "leitung", art: "person", label: "Leitung" },
      { id: "best", art: "dokument", label: "Arbeitskleidung" },
      { id: "d2", art: "dokument" },
      { id: "d3", art: "dokument" },
      { id: "sammel", art: "kasten", label: "Sammelbestellung" },
    ],
    schritte: [
      {
        titel: "Bestellung stellen",
        text: "Die Werkstatt bestellt Arbeitskleidung im Intranet statt per Zettel. Die Bestellung wartet auf die Entscheidung.",
        zustand: {
          ma: { x: 120, y: 215 },
          best: { x: 240, y: 180, abzeichen: "uhr", rand: "wartet" },
          leitung: { x: 480, y: 215, ...AUS },
          sammel: { x: 680, y: 190, ...AUS },
          d2: { x: 668, y: 200, ...AUS },
          d3: { x: 698, y: 200, ...AUS },
        },
      },
      {
        titel: "Bei der Leitung",
        text: "Die Leitung bekommt eine Meldung über die neue Freigabe und sieht, wer was bestellt hat.",
        zustand: { leitung: { sichtbar: true }, best: { x: 400, y: 180 } },
      },
      {
        titel: "Freigeben",
        text: "Ein Klick. Wer wann entschieden hat, steht im Verlauf. Die Antragstellerin erfährt es sofort, auch per Mail.",
        zustand: { best: { abzeichen: "haken", rand: "ok" }, leitung: { rand: "akzent" } },
      },
      {
        titel: "Sammelbestellung",
        text: "Freigegebene Bestellungen aller Häuser gehen gebündelt zu festen Terminen an den Lieferanten. Zehn Jahre bleiben sie aufbewahrt.",
        zustand: {
          leitung: { rand: null },
          sammel: { sichtbar: true },
          best: { x: 640, y: 200, abzeichen: null, rand: null, label: "" },
          d2: { sichtbar: true, x: 668, y: 190 },
          d3: { sichtbar: true, x: 698, y: 200 },
        },
      },
    ],
  },

  tickets: {
    figuren: [
      { id: "technik", art: "person", label: "Werkstatt" },
      { id: "t1", art: "ticket", label: "Hebebühne" },
      { id: "t2", art: "ticket", label: "Hebebühne" },
      { id: "t3", art: "ticket", label: "Hebebühne" },
      { id: "haus", art: "person", label: "Haustechnik" },
    ],
    schritte: [
      {
        titel: "Störung melden",
        text: "Die Werkstatt meldet eine defekte Hebebühne als Serviceanfrage, statt es durch die Halle zu rufen.",
        zustand: {
          technik: { x: 120, y: 220 },
          t1: { x: 250, y: 180, abzeichen: "uhr", rand: "wartet" },
          t2: { x: 330, y: 110, ...AUS },
          t3: { x: 440, y: 110, ...AUS },
          haus: { x: 660, y: 220 },
        },
      },
      {
        titel: "Zugewiesen",
        text: "Die Anfrage geht an die zuständige Stelle, an IT, Haustechnik, Personal oder Marketing, und bekommt eine Verantwortliche.",
        zustand: { t1: { x: 560, y: 175, rand: "akzent" }, haus: { rand: "akzent" } },
      },
      {
        titel: "Gelöst",
        text: "Der Verlauf hält fest, wer was getan hat. Die Meldende sieht, dass es erledigt ist.",
        zustand: { t1: { abzeichen: "haken", rand: "ok" }, haus: { rand: null, abzeichen: "haken" } },
      },
      {
        titel: "Muster erkennen",
        text: "Kommt dieselbe Störung wieder, wird das über die Zeit sichtbar. Serviceanfragen bleiben dafür zwei Jahre erhalten.",
        zustand: {
          t2: { sichtbar: true, abzeichen: "haken", rand: "ok" },
          t3: { sichtbar: true, abzeichen: "uhr", rand: "wartet" },
        },
      },
    ],
  },

  onboarding: {
    figuren: [
      { id: "neu", art: "person", label: "Neu im Haus" },
      { id: "plan", art: "checkliste", label: "Einarbeitungsplan" },
      { id: "leitung", art: "person", label: "Führungskraft" },
    ],
    schritte: [
      {
        titel: "Plan zuweisen",
        text: "Zum ersten Tag bekommt die neue Kollegin einen Einarbeitungsplan für ihre Rolle: Verkauf, Werkstatt, Verwaltung.",
        zustand: {
          neu: { x: 140, y: 220 },
          plan: { x: 400, y: 180, werte: [0, 0, 0] },
          leitung: { x: 660, y: 220, ...AUS },
        },
      },
      {
        titel: "Abhaken",
        text: "Schritt für Schritt: Zugang einrichten, Haus kennenlernen, erste Schulung. Die Checkliste führt durch die ersten Wochen.",
        zustand: { plan: { werte: [1, 1, 0] }, neu: { abzeichen: "haken" } },
      },
      {
        titel: "Fortschritt sichtbar",
        text: "Die Führungskraft sieht, wie weit die Einarbeitung ist, ohne nachzufragen.",
        zustand: { leitung: { sichtbar: true, abzeichen: "haken" }, plan: { werte: [1, 1, 1], rand: "ok" } },
      },
    ],
  },

  absences: {
    figuren: [
      { id: "ma", art: "person", label: "Mitarbeiterin" },
      { id: "kal", art: "kalender", label: "Urlaub" },
      { id: "leitung", art: "person", label: "Führungskraft" },
    ],
    schritte: [
      {
        titel: "Urlaub beantragen",
        text: "Der Antrag geht im Intranet raus, mit Zeitraum und Art der Abwesenheit. Kein Zettel auf dem Schreibtisch.",
        zustand: {
          ma: { x: 130, y: 220 },
          kal: { x: 400, y: 160, werte: [8, 9, 10], abzeichen: "uhr", rand: "wartet" },
          leitung: { x: 670, y: 220 },
        },
      },
      {
        titel: "Die Führungskraft entscheidet",
        text: "Die Führungskraft sieht den Antrag und entscheidet im Intranet.",
        zustand: { leitung: { rand: "akzent" }, kal: { x: 520 } },
      },
      {
        titel: "Genehmigt",
        text: "Die Entscheidung kommt bei der Antragstellerin an, auch per Mail, wenn der Versand eingerichtet ist. Krankmeldungen enthalten keine Diagnose, nur den Zeitraum.",
        zustand: { kal: { abzeichen: "haken", rand: "ok" }, ma: { abzeichen: "haken" }, leitung: { rand: null } },
      },
    ],
  },

  calendar: {
    figuren: [
      { id: "kal", art: "kalender", label: "Kalender" },
      { id: "h1", art: "haus", label: "Haus Nord" },
      { id: "h2", art: "haus", label: "Haus Süd" },
      { id: "h3", art: "haus", label: "Haus West" },
    ],
    schritte: [
      {
        titel: "Termine eintragen",
        text: "Schulungen, Aktionen und Wartungsfenster stehen in einem gemeinsamen Kalender.",
        zustand: {
          kal: { x: 220, y: 160, werte: [9] },
          h1: { x: 470, y: 215, ...AUS },
          h2: { x: 580, y: 215, ...AUS },
          h3: { x: 690, y: 215, ...AUS },
        },
      },
      {
        titel: "Für wen?",
        text: "Ein Termin zeigt sich nur den Häusern, die er betrifft. Die Herstellerschulung steht dort, wo sie jemand sucht.",
        zustand: {
          kal: { werte: [9, 10] },
          h1: { sichtbar: true, rand: "akzent" },
          h2: { sichtbar: true, rand: "akzent" },
          h3: { sichtbar: true, gedimmt: true },
        },
      },
      {
        titel: "Alle im Bilde",
        text: 'Wer im Kalender nachsieht, findet, was ansteht. Die Frage "Wann ist die Schulung?" beantwortet sich selbst.',
        zustand: { kal: { werte: [9, 10, 16], rand: "ok" }, h1: { abzeichen: "haken" }, h2: { abzeichen: "haken" } },
      },
    ],
  },

  rooms: {
    figuren: [
      { id: "a", art: "person", label: "Person A" },
      { id: "b", art: "person", label: "Person B" },
      { id: "r1", art: "raum", label: "Schulungsraum" },
      { id: "r2", art: "raum", label: "Besprechung" },
    ],
    schritte: [
      {
        titel: "Raum buchen",
        text: "Person A bucht den Schulungsraum für Dienstagvormittag, auch wenn er in einem anderen Haus liegt.",
        zustand: {
          a: { x: 130, y: 225 },
          b: { x: 690, y: 225, ...AUS },
          r1: { x: 320, y: 170, abzeichen: "haken", rand: "ok" },
          r2: { x: 520, y: 170 },
        },
      },
      {
        titel: "Doppelbuchung?",
        text: "Person B möchte denselben Raum zur selben Zeit. Das geht nicht: die Buchung wird abgewiesen.",
        zustand: { b: { sichtbar: true, x: 480, y: 225, abzeichen: "frage" }, r1: { rand: "wartet" } },
      },
      {
        titel: "Anderer Raum",
        text: "Person B nimmt die Besprechung. Beide haben ihren Raum, niemand steht vor einer verschlossenen Tür.",
        zustand: {
          b: { x: 670, y: 225, abzeichen: "haken" },
          r2: { abzeichen: "haken", rand: "ok" },
          r1: { rand: "ok" },
        },
      },
    ],
  },

  shifts: {
    figuren: [
      { id: "a", art: "person", label: "Person A" },
      { id: "b", art: "person", label: "Person B" },
      { id: "leitung", art: "person", label: "Leitung" },
      { id: "schicht", art: "schicht", label: "So 11–16" },
    ],
    schritte: [
      {
        titel: "Eine Schicht, ein Wunsch",
        text: "Person A ist am Sonntag zum Schautag eingeteilt, kann aber nicht. Im Schichtplan möchte sie tauschen.",
        zustand: {
          a: { x: 150, y: 225 },
          b: { x: 400, y: 225 },
          leitung: { x: 650, y: 225 },
          schicht: { x: 150, y: 130 },
        },
      },
      {
        titel: "Erste Zustimmung",
        text: "Person A fragt Person B. Ohne deren Ja ändert sich nichts, niemand bekommt eine Schicht aufgedrückt.",
        zustand: { schicht: { x: 275, y: 150, rand: "wartet" }, b: { abzeichen: "frage" } },
      },
      {
        titel: "B stimmt zu",
        text: "Person B sagt zu. Damit steht der Tausch zwischen beiden fest, aber noch nicht im Plan.",
        zustand: { b: { abzeichen: "haken" }, schicht: { x: 400, y: 130 }, leitung: { abzeichen: "uhr" } },
      },
      {
        titel: "Zweite Zustimmung",
        text: "Die Leitung gibt den Tausch frei. Erst jetzt wechselt die Besetzung, sonst ließe sie sich an der Leitung vorbei ändern. Ruhezeiten prüft das Modul noch nicht.",
        zustand: { leitung: { abzeichen: "haken" }, schicht: { rand: "ok" }, a: { abzeichen: null } },
      },
    ],
  },

  custody: {
    figuren: [
      { id: "verkauf", art: "person", label: "Verkauf" },
      { id: "werkstatt", art: "person", label: "Werkstatt" },
      { id: "kundin", art: "person", label: "Kundin" },
      { id: "key", art: "schluessel", label: "Schlüssel" },
      { id: "log", art: "dokument", label: "Verlauf" },
    ],
    schritte: [
      {
        titel: "Aufnahme",
        text: "Der Schlüssel wird im Verzeichnis aufgenommen: was, von wem, wann.",
        zustand: {
          verkauf: { x: 130, y: 225 },
          werkstatt: { x: 400, y: 225 },
          kundin: { x: 670, y: 225 },
          key: { x: 130, y: 140, abzeichen: "haken" },
          log: { x: 400, y: 100, ...AUS },
        },
      },
      {
        titel: "Übergabe an die Werkstatt",
        text: "Jede Bewegung hat eine handelnde Person und einen Zeitstempel. Wer den Schlüssel hat, steht jederzeit da.",
        zustand: { key: { x: 400, y: 140, abzeichen: "uhr", rand: "wartet" }, log: { sichtbar: true } },
      },
      {
        titel: "Abholung",
        text: "Eine Kundin hat kein Konto. Deshalb geht eine Übergabe auch an einen freien Namen, sonst würde sie gar nicht festgehalten.",
        zustand: { key: { x: 670, y: 140, abzeichen: "haken", rand: "ok" }, kundin: { abzeichen: "haken" } },
      },
      {
        titel: "Der Verlauf",
        text: "Der Verlauf beantwortet die Frage, wer den Schlüssel im März hatte. Abgeschlossene Vorgänge werden nach drei Jahren gelöscht.",
        zustand: { log: { rand: "ok", x: 400, y: 110 } },
      },
    ],
  },

  meals: {
    figuren: [
      { id: "kueche", art: "person", label: "Küche" },
      { id: "teller", art: "teller", label: "Tagesangebot" },
      { id: "ma", art: "person", label: "Mitarbeitende" },
      { id: "spaet", art: "person", label: "Zu spät" },
      { id: "liste", art: "dokument", label: "Sammelliste" },
    ],
    schritte: [
      {
        titel: "Tagesangebot",
        text: "Die Küche stellt das Angebot des Tages ein, je Haus, mit Bestellschluss.",
        zustand: {
          kueche: { x: 120, y: 225 },
          teller: { x: 290, y: 175 },
          ma: { x: 470, y: 225, ...AUS },
          spaet: { x: 600, y: 225, ...AUS },
          liste: { x: 700, y: 150, ...AUS },
        },
      },
      {
        titel: "Bis zum Stichtag",
        text: "Wer bis zum Bestellschluss bestellt, bekommt sein Essen.",
        zustand: { ma: { sichtbar: true, abzeichen: "haken" }, teller: { rand: "akzent" } },
      },
      {
        titel: "Danach nicht mehr",
        text: "Wer nach dem Bestellschluss bestellt, bekommt nichts. Das prüft der Server, es steht nicht nur auf dem Bildschirm.",
        zustand: {
          spaet: { sichtbar: true, abzeichen: "frage", gedimmt: true },
          teller: { rand: "wartet", abzeichen: "uhr" },
        },
      },
      {
        titel: "Sammelliste",
        text: "Eine Liste für die Abholung statt vieler Einzelbestellungen. Essensbestellungen werden nach 90 Tagen gelöscht.",
        zustand: { liste: { sichtbar: true, x: 440, y: 120, rand: "ok" }, teller: { abzeichen: "haken", rand: "ok" } },
      },
    ],
  },

  admin: {
    figuren: [
      { id: "admin", art: "person", label: "Administration" },
      { id: "zahn", art: "zahnrad" },
      { id: "rolle1", art: "kachel", label: "Serviceberatung" },
      { id: "rolle2", art: "kachel", label: "Verkaufsleitung" },
      { id: "modul", art: "kachel", label: "Modul" },
    ],
    schritte: [
      {
        titel: "Konten und Standorte",
        text: "Die Administration legt Konten an, sperrt sie und setzt Passwörter zurück, ohne IT-Termin.",
        zustand: {
          admin: { x: 130, y: 225 },
          zahn: { x: 280, y: 150 },
          rolle1: { x: 470, y: 150, ...AUS },
          rolle2: { x: 590, y: 150, ...AUS },
          modul: { x: 530, y: 235, ...AUS },
        },
      },
      {
        titel: "Eigene Rollen",
        text: "Jedes Haus baut eigene Rollen und vergibt Rechte, etwa für die Serviceberatung oder die Verkaufsleitung.",
        zustand: { rolle1: { sichtbar: true, rand: "akzent" }, rolle2: { sichtbar: true, rand: "akzent" } },
      },
      {
        titel: "Module je Haus",
        text: "Module werden ein- und ausgeschaltet. Was abgeschaltet ist, verhält sich nach außen, als gäbe es es nicht.",
        zustand: { modul: { sichtbar: true, rand: "ok", abzeichen: "haken" } },
      },
      {
        titel: "Keine Aussperrung",
        text: "Nach jeder Änderung an den Rollen prüft AHOI, dass noch ein aktives Konto Rollen und Benutzer verwalten darf. Sonst wird alles zurückgenommen.",
        zustand: { admin: { abzeichen: "haken" }, zahn: { rand: "ok" } },
      },
    ],
  },

  audit: {
    figuren: [
      { id: "p1", art: "person", label: "Leitung" },
      { id: "log", art: "dokument", label: "Protokoll" },
      { id: "lupe", art: "lupe" },
      { id: "kal", art: "kalender", label: "Nach 3 Jahren" },
    ],
    schritte: [
      {
        titel: "Etwas passiert",
        text: "Die Leitung ändert eine Rolle oder gibt eine Bestellung frei. Jede fachlich relevante Aktion wird festgehalten.",
        zustand: {
          p1: { x: 130, y: 225, abzeichen: "haken" },
          log: { x: 400, y: 180 },
          lupe: { x: 600, y: 140, ...AUS },
          kal: { x: 680, y: 190, werte: [], ...AUS },
        },
      },
      {
        titel: "Nachvollziehbar",
        text: "Wer hat was wann getan? Das Protokoll beantwortet es, auch Monate später.",
        zustand: { log: { rand: "akzent", abzeichen: "haken" }, lupe: { sichtbar: true, x: 480, y: 130 } },
      },
      {
        titel: "Nicht ewig",
        text: "Das Protokoll wird nach drei Jahren gelöscht. Länger wäre eine Vorratsdatenhaltung über das Personal.",
        zustand: {
          lupe: { x: 540, y: 130 },
          kal: { sichtbar: true, werte: [12, 13, 14] },
          log: { gedimmt: true, rand: null },
        },
      },
    ],
  },
};

export function szeneFuer(modulKey: string): Szene | undefined {
  return MODUL_SZENEN[modulKey];
}
