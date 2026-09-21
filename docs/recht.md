# Rechtsregister je Modul

Was ein Haus wissen muss, bevor es ein Modul einschaltet.

> **Kein Rechtsrat.** Dieses Dokument ist eine begründete Vorarbeit, damit das
> Gespräch mit Anwaltschaft und Arbeitnehmervertretung nicht bei null beginnt.
> Es ersetzt die Prüfung im Einzelfall nicht. Wo es heißt „vermutlich" oder
> „strittig", ist genau das gemeint.

## Wer wofür verantwortlich ist

| Rolle                                     | Wer                    | Wofür                                                                                         |
| ----------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------- |
| **Verantwortlicher** (Art. 4 Nr. 7 DSGVO) | das Autohaus           | Zweck und Mittel der Verarbeitung, Auskunft, Löschung, Verzeichnis, Meldung von Pannen        |
| **Auftragsverarbeiter** (Art. 28)         | der Betreiber von AHOI | verarbeitet nur auf Weisung; braucht einen Vertrag, **bevor** die ersten echten Daten fließen |
| **Unterauftragsverarbeiter**              | der Hoster             | eigener Vertrag, Genehmigung durch das Haus                                                   |

Vorlage: [`vorlagen/auftragsverarbeitung.md`](vorlagen/auftragsverarbeitung.md).

## Was für jedes Modul gilt

**Rechtsgrundlage.** Für Beschäftigtendaten kommen in Betracht: Art. 6 Abs. 1
lit. b DSGVO (Durchführung des Arbeitsverhältnisses), lit. f (berechtigtes
Interesse), lit. c (rechtliche Pflicht) und § 26 Abs. 1 BDSG.

> **Strittig, und das gehört gesagt:** Der EuGH hat mit Urteil vom 30.03.2023
> (C-34/21, _Hauptpersonalrat der Lehrerinnen und Lehrer_) zur wortgleichen
> hessischen Vorschrift entschieden, dass eine nationale Norm zur
> Beschäftigtendatenverarbeitung nur trägt, wenn sie über Art. 88 Abs. 2 DSGVO
> hinausgehende Schutzvorschriften enthält. Seither ist unsicher, ob § 26
> Abs. 1 BDSG allein trägt. **Praktische Folge:** Stützen Sie sich nicht allein
> auf § 26 BDSG, sondern führen Sie Art. 6 Abs. 1 lit. b bzw. f daneben und
> dokumentieren Sie bei lit. f die Interessenabwägung.

**Mitbestimmung.** § 87 Abs. 1 Nr. 6 BetrVG greift bei technischen
Einrichtungen, die zur Überwachung von Verhalten oder Leistung **bestimmt
sind**. Das Bundesarbeitsgericht legt das weit aus: Die **objektive Eignung**
genügt, eine Überwachungsabsicht ist nicht nötig. Weil AHOI je Vorgang festhält,
wer wann was getan hat, ist praktisch **das gesamte Intranet
mitbestimmungspflichtig**, sobald ein Betriebsrat besteht.

Daraus folgt: **eine Rahmen-Betriebsvereinbarung für das Intranet**, mit Anlagen
je Modul. Entwurf: [`vorlagen/betriebsvereinbarung.md`](vorlagen/betriebsvereinbarung.md).

Ohne Betriebsrat entfällt die Mitbestimmung – nicht aber die Information der
Beschäftigten nach Art. 13 DSGVO.

**Verzeichnis der Verarbeitungstätigkeiten** (Art. 30): führt das Haus. Die
Spalten „Zweck", „Kategorien", „Frist" je Modul stehen unten; die Fristen
zusätzlich maschinenlesbar in `packages/shared/src/retention.ts` und in der
Oberfläche unter _Administration → Datenschutz_.

**Datenschutz-Folgenabschätzung** (Art. 35): bei 20–80 Beschäftigten in aller
Regel nicht zwingend, weil keine systematische umfangreiche Überwachung
stattfindet. **Aber:** Die Schwellwertprüfung gehört trotzdem dokumentiert, und
sie fällt anders aus, wenn Schichtplan, Audit-Log und Lesebestätigungen
zusammen ausgewertet würden. Wer das vorhat, braucht die Folgenabschätzung.

---

## Übersicht

| Modul                  | Mitbestimmung                | Art. 9                  | Frist                      | Schärfe    |
| ---------------------- | ---------------------------- | ----------------------- | -------------------------- | ---------- |
| Dashboard              | Nr. 6 (mittelbar)            | –                       | –                          | gering     |
| Globale Suche          | Nr. 6 (mittelbar)            | –                       | –                          | gering     |
| Benachrichtigungen     | Nr. 6                        | –                       | 90 Tage                    | gering     |
| Schnellzugriffe        | –                            | –                       | –                          | gering     |
| **Aktuelles**          | **Nr. 1, Nr. 6**             | –                       | 180 Tage (Lesebestätigung) | **mittel** |
| Mitarbeiterverzeichnis | Nr. 1, Nr. 6                 | –                       | mit dem Konto              | mittel     |
| **Umfragen**           | **Nr. 1, Nr. 6**             | möglich                 | –                          | **hoch**   |
| Ideenmanagement        | Nr. 1, Nr. 6                 | –                       | –                          | mittel     |
| Dokumente              | Nr. 1                        | –                       | –                          | gering     |
| Wissensdatenbank       | –                            | –                       | –                          | gering     |
| Bestellungen           | Nr. 6                        | –                       | **10 Jahre, kein Löschen** | mittel     |
| Freigaben              | Nr. 6                        | –                       | wie Bestellungen           | mittel     |
| Serviceanfragen        | Nr. 6                        | über Freitext möglich   | 2 Jahre                    | mittel     |
| **Onboarding**         | **Nr. 6**                    | –                       | mit dem Konto              | **mittel** |
| **Abwesenheiten**      | **Nr. 5, Nr. 6**             | **ja – Krankmeldung**   | 3 Jahre                    | **hoch**   |
| Kalender               | Nr. 6                        | –                       | –                          | gering     |
| Raumbuchung            | Nr. 6                        | –                       | 1 Jahr                     | gering     |
| **Schichtplan**        | **Nr. 2, Nr. 3, ggf. § 99**  | –                       | 2 Jahre                    | **hoch**   |
| Fundsachen & Schlüssel | Nr. 6                        | –                       | 3 Jahre                    | mittel     |
| **Essensbestellung**   | **Nr. 1, ggf. Nr. 8**        | **möglich – Ernährung** | 90 Tage                    | **hoch**   |
| Administration         | Nr. 6                        | –                       | –                          | mittel     |
| **Audit-Log**          | **Nr. 6 – klassischer Fall** | –                       | 3 Jahre                    | **hoch**   |

Paragraphen ohne Zusatz sind § 87 Abs. 1 BetrVG.

---

## Fristen im Überblick

Die Tabelle entspricht `packages/shared/src/retention.ts`; ein Test hält
beide aneinander. In der Anwendung steht sie unter _Administration →
Datenschutz_, dort auch mit Vorschau, wie viele Datensätze ein Lauf träfe.

| Datenart                                 | Frist    | Was geschieht | Warum                                                                                                 |
| ---------------------------------------- | -------- | ------------- | ----------------------------------------------------------------------------------------------------- |
| Benachrichtigungen                       | 90 Tage  | wird gelöscht | Reiner Zustellweg ohne eigenen Beweiswert.                                                            |
| Lesebestätigungen                        | 180 Tage | wird gelöscht | Verhaltensdaten mit hohem Personenbezug und geringem Nutzen nach kurzer Zeit.                         |
| Audit-Log                                | 3 Jahre  | wird gelöscht | Nachweis von Änderungen an Rechten, Freigaben und Stammdaten.                                         |
| Raumbuchungen                            | 1 Jahr   | wird gelöscht | Nach Ablauf des Geschäftsjahres ohne Nutzen; kein handels- oder steuerrechtlicher Bezug.              |
| Serviceanfragen                          | 2 Jahre  | wird gelöscht | Wiederkehrende Störungen bleiben über zwei Jahre erkennbar, danach überwiegt der Personenbezug.       |
| Abwesenheiten                            | 3 Jahre  | wird gelöscht | Urlaubsansprüche verjähren regelmäßig in drei Jahren.                                                 |
| Bestellungen und Freigaben               | 10 Jahre | **bleibt**    | Buchungsrelevante Unterlagen.                                                                         |
| Schichtplan und Diensttausch             | 2 Jahre  | wird gelöscht | Der Schichtplan ist eine Planung, kein Arbeitszeitnachweis.                                           |
| Verwahrung von Fundsachen und Schlüsseln | 3 Jahre  | wird gelöscht | Schlüsselübergaben sind sicherheitsrelevant und müssen sich über längere Zeit zurückverfolgen lassen. |
| Essensbestellungen                       | 90 Tage  | wird gelöscht | Nach der Abrechnung des Monats ohne Zweck.                                                            |
| Personalstammdaten                       | 10 Jahre | **bleibt**    | Solange das Arbeitsverhältnis besteht, ist die Verarbeitung für dessen Durchführung erforderlich.     |

**`bleibt` heißt wirklich bleibt.** Ein Löschverlangen nach Art. 17 läuft
gegen Art. 17 Abs. 3 lit. b, wenn eine gesetzliche Aufbewahrungspflicht
entgegensteht. AHOI **anonymisiert** dann das Konto, statt den Vorgang zu
zerstören – das ist der einzige Weg, beide Pflichten zu erfüllen.

---

## Die vier scharfen Module

### Abwesenheiten – Gesundheitsdaten

**Das Modul speichert die Abwesenheitsart, und eine davon ist `krank`.** Damit
verarbeitet es Daten über die Gesundheit: besondere Kategorie nach Art. 9
Abs. 1 DSGVO, für die ein Verarbeitungsverbot mit Erlaubnisvorbehalt gilt.

- **Rechtsgrundlage:** Art. 9 Abs. 2 lit. b DSGVO i. V. m. § 26 Abs. 3 BDSG –
  Ausübung von Rechten aus dem Arbeitsrecht. Die Entgeltfortzahlung ist so ein
  Recht; die Kenntnis der **Diagnose** ist es nicht.
- **Grenze im Entwurf:** AHOI speichert **keine Diagnose** und kein Attest,
  sondern nur „krank" mit Zeitraum. Das ist Absicht und sollte so bleiben.
  Wer ein Feld für Diagnosen ergänzt, verlässt den zulässigen Rahmen.
- **Zugriff:** nur über `absences.approve` bzw. `absences.viewAll`. Wer diese
  Rechte einer Rolle gibt, gibt Zugriff auf Gesundheitsdaten – das gehört in
  die Betriebsvereinbarung und nicht in eine stille Rollenänderung.
- **Mitbestimmung:** § 87 Abs. 1 Nr. 5 (Urlaubsgrundsätze und -plan) und Nr. 6.
- **Frist:** 3 Jahre. Hintergrund ist die regelmäßige Verjährung (§ 195 BGB).
  Beachten Sie, dass Urlaubsansprüche nach EuGH und BAG (2022) erst verjähren,
  wenn der Arbeitgeber auf Verfall hingewiesen hat – im Streitfall kann eine
  längere Aufbewahrung nötig sein.

### Schichtplan – Arbeitszeit, und eine Lücke, die AHOI nicht schließt

- **Mitbestimmung, zwingend:** § 87 Abs. 1 Nr. 2 (Beginn und Ende der
  täglichen Arbeitszeit, Pausen, Verteilung auf die Wochentage) und Nr. 3
  (vorübergehende Verkürzung oder Verlängerung). **Ein Schichtplan ohne
  Betriebsvereinbarung ist angreifbar, und zwar rückwirkend.** Schalten Sie das
  Modul erst nach der Einigung ein.
- **§ 99 BetrVG** kann hinzukommen, wenn eine Zuweisung dauerhaft ist und den
  Arbeitsbereich erheblich ändert – dann liegt eine Versetzung nach § 95 Abs. 3
  vor, die der Zustimmung bedarf. Der einzelne Diensttausch ist das nicht.
- **Die Lücke, ehrlich benannt:** AHOI weist **Doppelbelegungen** ab – dieselbe
  Person kann nicht zur selben Zeit an zwei Orten stehen. Es prüft **nicht**
  die **Ruhezeit von elf Stunden** nach § 5 ArbZG, nicht die Höchstarbeitszeit
  nach § 3 ArbZG und keine Pausen nach § 4 ArbZG. Ein Spätdienst bis 22 Uhr und
  ein Frühdienst ab 6 Uhr am Folgetag werden anstandslos gespeichert, sind aber
  rechtswidrig. **Die Einhaltung bleibt beim Haus.** Wenn Sie das automatisiert
  haben wollen, sagen Sie Bescheid – gebaut ist es nicht, und es zu behaupten
  wäre schlimmer als die Lücke.
- **Frist:** 2 Jahre, in Anlehnung an § 16 Abs. 2 ArbZG. Der Plan ist kein
  Arbeitszeitnachweis; wer einen führen muss (§ 17 MiLoG, und nach dem
  BAG-Beschluss vom 13.09.2022 zur Erfassungspflicht ohnehin), führt ihn
  woanders – AHOI ist keine Zeiterfassung.

### Umfragen – nicht anonym, auch wenn es so aussieht

**Jede Stimme trägt die Kennung der abstimmenden Person** (`PollVote.userId`,
mit Eindeutigkeitsbedingung je Umfrage). Das ist technisch nötig, damit niemand
zweimal abstimmt – es bedeutet aber:

> **Eine Umfrage in AHOI ist keine anonyme Mitarbeiterbefragung.** Wer sie als
> solche ankündigt, sagt die Unwahrheit. Die Administration kann über den
> Datenbestand nachvollziehen, wer wie gestimmt hat.

- **Folge für die Praxis:** Für Stimmungsbilder, Kritik an Vorgesetzten oder
  alles, was Freimut braucht, ist das Modul **ungeeignet**. Nutzen Sie es für
  Terminabstimmungen, Essenswünsche, Themenwahl – nicht für Befragungen, deren
  Wert von der Anonymität abhängt.
- **Art. 9 möglich:** Fragt jemand nach Ernährung, Gesundheit, Gewerkschaft
  oder Religion, entstehen besondere Kategorien. Dann greift das Verbot des
  Art. 9 Abs. 1 – mit Einwilligung nach Art. 9 Abs. 2 lit. a, deren
  Freiwilligkeit im Arbeitsverhältnis nach § 26 Abs. 2 BDSG erst belegt werden
  muss.
- **Mitbestimmung:** § 87 Abs. 1 Nr. 1 und Nr. 6.
- **Kleine Zielgruppen verschärfen das.** Eine Umfrage lässt sich bis auf eine
  Abteilung an einem Standort eingrenzen. Bei drei Beschäftigten im Zuschnitt
  ist die Auswertung faktisch eine Namensliste – auch ohne Blick in die
  Datenbank. Wer so zuschneidet, sollte die Frage danach aussuchen: eine
  Terminabstimmung ist unproblematisch, eine Frage zur Zufriedenheit mit der
  Leitung ist es nicht. Die Oberfläche nennt die Zielgruppe deshalb im Klartext
  an jeder Umfrage, für die Abstimmenden sichtbar.
- **Empfehlung:** Nehmen Sie in die Betriebsvereinbarung auf, welche Fragen
  zulässig sind, und weisen Sie in der Umfrage sichtbar darauf hin, dass die
  Stimme nicht anonym ist.

### Audit-Log – der klassische Fall des § 87 Abs. 1 Nr. 6

Das Protokoll hält fest, wer wann welche fachliche Aktion ausgelöst hat. Das ist
**genau die technische Einrichtung**, die der Gesetzgeber im Blick hatte.

- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. f – Nachvollziehbarkeit und
  IT-Sicherheit. Die Interessenabwägung gehört schriftlich.
- **Zweckbindung ist hier alles:** Das Log dient der Aufklärung im Verdachtsfall
  und der Sicherheit, **nicht** der Leistungskontrolle. Eine Betriebsvereinbarung
  sollte ausdrücklich verbieten, es für Bewertungen auszuwerten, und ein
  Vier-Augen-Prinzip für Auswertungen vorsehen.
- **Zugriff:** nur über `audit.read`.
- **Frist:** 3 Jahre.

---

## Die übrigen Module

### Aktuelles

**Lesebestätigungen sind Verhaltensdaten.** AHOI hält fest, wer welchen Beitrag
wann gelesen hat. Das ist nützlich bei Pflichtaushängen und heikel als Maßstab.
Die Frist ist deshalb mit **180 Tagen die kürzeste** im System.

Mitbestimmung: § 87 Abs. 1 Nr. 1 (Ordnung des Betriebs, wenn es um verbindliche
Aushänge geht) und Nr. 6. Kommentarfunktion: Meinungsäußerung, Regeln zum
Umgangston gehören in die Betriebsvereinbarung, nicht in eine spontane Löschung.

### Mitarbeiterverzeichnis

- **Dienstliche** Kontaktdaten: Art. 6 Abs. 1 lit. b – zulässig ohne Einwilligung.
- **Private** Mobilnummer und **Lichtbild**: nur mit **Einwilligung**, jederzeit
  widerruflich. Beim Foto zusätzlich das Recht am eigenen Bild (§§ 22 f. KUG als
  Maßstab). AHOI erzwingt das nicht technisch – die Einwilligung einzuholen ist
  Sache des Hauses.
- **Anwesenheitsstatus** („vor Ort", „mobil", „abwesend"): erleichtert die
  Erreichbarkeit und ist zugleich ein Verhaltensdatum. Mitbestimmung Nr. 6.
  Empfehlung: selbst gesetzt, nicht automatisch abgeleitet – so ist es in AHOI
  gebaut, und so sollte es bleiben.

### Bestellungen und Freigaben

- **Zehn Jahre, und keine Löschung auf Wunsch.** Freigegebene Bestellungen sind
  buchungsrelevant (§ 147 AO, § 257 HGB). Ein Löschverlangen nach Art. 17 läuft
  hier gegen Art. 17 Abs. 3 lit. b.
- **Deshalb anonymisiert AHOI statt zu löschen:** Das Konto verliert seine
  Identität, der Vorgang bleibt. Das ist der einzige Weg, beide Pflichten zu
  erfüllen – und er gehört der betroffenen Person auf Nachfrage erklärt.
- Freigabeentscheidungen mit Name und Zeitpunkt: Mitbestimmung Nr. 6.

### Serviceanfragen

Freitext ist das Risiko: In „Ich komme nicht zur Arbeit, mein Rücken" steht ein
Gesundheitsdatum, ohne dass ein Feld es als solches ausweist. Die Auskunft nach
Art. 15 führt diese Stellen auf, kann sie aber nicht maschinell erkennen.
Weisen Sie die Beschäftigten darauf hin, dass ein Ticket kein vertraulicher
Kanal für Persönliches ist. Frist: 2 Jahre.

### Onboarding

Der Fortschritt einer neuen Person ist dokumentiert – wer welchen Schritt wann
erledigt hat. Das ist **Leistungsbezug** und damit Nr. 6. Zweckbindung: die
Einarbeitung zu steuern, nicht die Probezeitbeurteilung zu unterfüttern. Nach
Abschluss der Einarbeitung ist die Zuordnung zu löschen oder zu aggregieren.

### Fundsachen und Schlüssel

- **Fundsachen:** §§ 965 ff. BGB. Anzeigepflicht, Verwahrung, Eigentumserwerb
  der finderin oder des Finders nach sechs Monaten (§ 973 BGB). Bei Funden in
  Geschäftsräumen gilt § 978 BGB (Fund in Verkehrsmitteln und Geschäftsräumen)
  – das Haus ist Empfangsstelle.
- **Schlüssel:** Wer wann welchen Schlüssel hatte, ist ein Verhaltensdatum und
  im Schadensfall ein Beweismittel. Nr. 6. Frist 3 Jahre, ausgegebene Schlüssel
  werden **nie** weggeräumt, egal wie alt die Ausgabe ist.
- **Freie Namen:** Eine Übergabe an eine Kundin wird mit Namen festgehalten.
  Das sind Daten Dritter – Rechtsgrundlage Art. 6 Abs. 1 lit. f, und der
  Eintrag gehört gelöscht, sobald der Vorgang abgeschlossen ist.

### Essensbestellung

- **Aus Essgewohnheiten lassen sich Rückschlüsse ziehen.** „Vegetarisch",
  „halal", „glutenfrei" deuten auf Weltanschauung, Religion oder Gesundheit –
  besondere Kategorien nach Art. 9. Deshalb die **kurze Frist von 90 Tagen**.
- **Freiwilligkeit:** Die Teilnahme muss freiwillig sein und darf keinen
  Nachteil haben. Rechtsgrundlage ist am ehesten die Einwilligung (Art. 6
  Abs. 1 lit. a); § 26 Abs. 2 BDSG verlangt, die Freiwilligkeit zu belegen –
  bei einer Essensbestellung ist das gut machbar, weil niemand bestellen muss.
- **Mitbestimmung:** § 87 Abs. 1 Nr. 1. **Nr. 8** (Sozialeinrichtungen) greift,
  wenn das Haus die Verpflegung bezuschusst oder eine Kantine betreibt – bei
  einer bloßen Sammelbestellung beim Bäcker eher nicht.
- **Die Sammelliste zeigt Namen.** Sie hängt deshalb am Recht `meals.manage`
  und steht nicht jedem offen.

### Kalender, Raumbuchung, Dokumente, Wissensdatenbank, Schnellzugriffe

Geringe Schärfe. Buchungen zeigen, wer wann wo war (Nr. 6, Frist 1 Jahr).
Dokumente und Wissensseiten enthalten in der Regel keine Personendaten – prüfen
Sie das bei Vorlagen mit Beispieldaten. Schnellzugriffe sind reine Konfiguration.

### Dashboard, Suche, Benachrichtigungen

Keine eigene Verarbeitung: Sie zeigen, was die Fachmodule halten, und
unterliegen deren Rechtsgrundlagen. **Wichtig ist die Rechtetreue** – die Suche
darf nichts zeigen, was das Modul selbst verbergen würde. Genau dafür gibt es
die Prüfungen in `e2e/flows.js`.

### Administration

Die Rechteverwaltung entscheidet, wer Gesundheitsdaten sieht und wer nicht.
Jede Rollenänderung landet im Audit-Log. **Empfehlung:** Nehmen Sie in die
Betriebsvereinbarung auf, dass Änderungen an Rollen mit Zugriff auf
Abwesenheiten dem Betriebsrat mitzuteilen sind.

---

## Reihenfolge für das Pilothaus

1. **Auftragsverarbeitungsvertrag** unterschrieben – vor den ersten echten Daten.
2. **Information nach Art. 13** an alle Beschäftigten.
3. **Verzeichnis nach Art. 30** angelegt, je eingeschaltetem Modul eine Zeile.
4. **Betriebsvereinbarung**, falls ein Betriebsrat besteht – mindestens für
   Audit-Log, Abwesenheiten und Aktuelles.
5. Erst dann die Module einschalten. **Schichtplan, Umfragen und
   Essensbestellung zuletzt**, jeweils nach eigener Abstimmung.

## Was AHOI technisch beisteuert

| Pflicht                          | Wo                                                      |
| -------------------------------- | ------------------------------------------------------- |
| Auskunft (Art. 15)               | Administration → Datenschutz, als Datei                 |
| Löschung (Art. 17)               | als Anonymisierung, damit Aufbewahrungspflichten halten |
| Fristen (Art. 5 Abs. 1 lit. e)   | `retention.ts`, durchgesetzt vom Aufbewahrungslauf      |
| Zugriffsbeschränkung (Art. 32)   | Rechte je Rolle, serverseitig geprüft                   |
| Nachvollziehbarkeit              | Audit-Log                                               |
| Trennung mehrerer Häuser         | Mandantentrennung in der Datenschicht                   |
| Verschlüsselung von Geheimnissen | `core/geheimnis.ts`                                     |

Einzelheiten: [`datenschutz.md`](datenschutz.md).
