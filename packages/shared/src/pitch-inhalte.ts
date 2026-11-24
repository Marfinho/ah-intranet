/**
 * Texte der Pitch-Seite: was sich mit einem Modul im Alltag eines Autohauses tun
 * lässt. Konkret und aus dem Betrieb gegriffen - ein Interessent soll sich darin
 * wiederfinden, nicht eine Funktionsliste lesen.
 *
 * Ein Test hält die Liste an der Modulregistry: kommt ein Modul dazu, fehlt sein
 * Eintrag nicht unbemerkt.
 */
export const MODUL_NUTZEN: Readonly<Record<string, readonly string[]>> = {
  dashboard: [
    "Beim Anmelden sehen: neue Aushänge, offene Freigaben, heutige Termine.",
    "Eigene Aufgaben und Anträge auf einen Blick, ohne Menüs zu durchsuchen.",
    "Jede Person sieht, was für ihr Haus und ihre Abteilung gilt.",
  ],
  notifications: [
    "Eine Entscheidung über einen Antrag erreicht die Person sofort, auf Wunsch auch per Mail.",
    "Zugewiesene Serviceanfragen und neue Freigaben melden sich von selbst.",
    "Alles an einer Stelle statt in Zurufen, Zetteln und Chatgruppen.",
  ],
  admin: [
    "Konten anlegen, sperren und Passwörter zurücksetzen, ohne IT-Termin.",
    "Eigene Rollen bauen, etwa „Serviceberatung“ oder „Verkaufsleitung“, mit genau den Rechten, die sie braucht.",
    "Module je Haus ein- und ausschalten, Logo des Hauses hinterlegen.",
  ],
  search: [
    "Ein Suchfeld für Aushänge, Dokumente, Wissensseiten, Kolleginnen und Tickets.",
    "Die Preisliste vom letzten Jahr finden, ohne zu wissen, in welchem Ordner sie liegt.",
    "Ergebnisse zeigen nur, was die Person sehen darf.",
  ],
  quicklinks: [
    "DMS, Zeiterfassung und Herstellerportale als Kacheln auf der Startseite.",
    "Neue Mitarbeitende finden die wichtigen Systeme am ersten Tag.",
    "Das Intranet ersetzt kein DMS, es führt dorthin.",
  ],
  news: [
    "Einen Aushang genau an die Häuser oder Abteilungen schicken, für die er gilt.",
    "Wichtiges mit Lesebestätigung: wer hat die neue Arbeitsschutzregel gelesen?",
    "Kommentare und Fragen unter dem Beitrag statt in zehn Einzelnachrichten.",
  ],
  directory: [
    "Telefonbuch aller Häuser mit Abteilung, Zuständigkeit und Anwesenheit.",
    "Schnell die Person finden, die für Zulassung, Teile oder Garantie zuständig ist.",
    "Gepflegt an einer Stelle, nicht in einer Excel-Liste pro Haus.",
  ],
  polls: [
    "Eine Kurzumfrage an alle Häuser: Wunschtermin für die Betriebsfeier, Größen für die Arbeitskleidung.",
    "Ergebnisse in Echtzeit. Wichtig: Umfragen sind nicht anonym und werden auch so benannt.",
  ],
  ideas: [
    "Die Werkstatt reicht einen Verbesserungsvorschlag ein, die Leitung bewertet ihn.",
    "Der Bearbeitungsstand ist für alle sichtbar, nichts verschwindet im Postfach.",
    "Gute Ideen aus einem Haus kommen in allen anderen an.",
  ],
  documents: [
    "Formulare, Vorlagen und Richtlinien an einer Stelle, mit Zielgruppe je Dokument.",
    "Die aktuelle Fassung ersetzt die alte, niemand arbeitet mit dem Stand von gestern.",
    "Dokumente sind Verweise auf Ihr Laufwerk, keine zweite Ablage.",
  ],
  wiki: [
    "Anleitungen für Abläufe: Fahrzeugübergabe, Garantieabwicklung, Probefahrt.",
    "Markenstandards einer neuen Marke nachlesen statt nachfragen.",
    "Durchsuchbar und von den Fachleuten selbst gepflegt.",
  ],
  orders: [
    "Visitenkarten und Arbeitskleidung digital bestellen statt per Zettel.",
    "Sammelbestellungen zu festen Terminen bündeln, einmal je Haus.",
    "Jede Bestellung zeigt ihren Stand, vom Antrag bis zur Lieferung.",
  ],
  approvals: [
    "Die Leitung gibt Bestellungen mit einem Klick frei, auch vom Handy aus der Halle.",
    "Wer wann was freigegeben hat, steht nachvollziehbar im Verlauf.",
    "Freigegebene Vorgänge gehen gebündelt in die Sammelbestellung.",
  ],
  tickets: [
    "Die Technik meldet ein defektes Hebebühnen-Kabel, die Haustechnik bekommt es zugewiesen.",
    "Anfragen an IT, Facility, HR und Marketing mit Verlauf statt Zuruf.",
    "Wiederkehrende Störungen werden über die Zeit sichtbar.",
  ],
  onboarding: [
    "Neue Kolleginnen und Kollegen bekommen einen Einarbeitungsplan für ihre Rolle.",
    "Checklisten für den ersten Tag, die erste Woche, die ersten drei Monate.",
    "Die Führungskraft sieht den Fortschritt, ohne nachzufragen.",
  ],
  absences: [
    "Urlaub und Abwesenheit beantragen, die Führungskraft entscheidet im Intranet.",
    "Das Team sieht, wer wann fehlt, ohne Diagnosen zu kennen.",
    "Der Antrag landet nicht mehr auf dem Schreibtisch, sondern in der Freigabe.",
  ],
  calendar: [
    "Schulungen, Aktionen und Wartungsfenster für alle Häuser in einem Kalender.",
    "Termine nur den Häusern zeigen, die sie betreffen.",
    "Die Herstellerschulung steht dort, wo sie jeder findet.",
  ],
  rooms: [
    "Besprechungsraum und Schulungsraum häuserübergreifend buchen.",
    "Doppelbuchungen sind ausgeschlossen.",
    "Häuser am selben Standort teilen sich ihre Räume.",
  ],
  shifts: [
    "Besetzung je Haus und Abteilung planen, auch für den Sonntags-Schautag.",
    "Dienste tauschen: die Kollegin stimmt zu, die Leitung gibt frei.",
    "Doppelbelegungen werden abgewiesen. Ruhezeiten prüft das Modul noch nicht.",
  ],
  custody: [
    "Festhalten, wer welchen Schlüssel wann übernommen hat.",
    "Fundsachen aufnehmen und an Kundinnen ohne Konto übergeben, mit Zeitstempel.",
    "Der Verlauf beantwortet „wer hatte den Schlüssel im März?“.",
  ],
  meals: [
    "Tagesangebot je Haus mit Bestellschluss.",
    "Eine Sammelliste für die Abholung statt vieler Einzelbestellungen.",
    "Wer nach dem Bestellschluss bestellt, bekommt nichts, das prüft der Server.",
  ],
  audit: [
    "Jede fachlich relevante Aktion ist protokolliert: wer, was, wann.",
    "Änderungen an Rollen und Rechten sind nachvollziehbar.",
    "Das Protokoll wird nach drei Jahren gelöscht, nicht ewig vorgehalten.",
  ],
};
