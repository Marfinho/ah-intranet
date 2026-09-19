# Vertrag zur Auftragsverarbeitung (Vorlage)

nach Art. 28 Abs. 3 DSGVO

> **Vorlage, kein geprüfter Vertrag.** Sie ist vollständig genug, um mit einer
> Anwältin oder einem Anwalt daran zu arbeiten, statt bei null zu beginnen.
> Unterschreiben Sie sie nicht ungeprüft. Platzhalter stehen in `[eckigen
Klammern]`.

---

zwischen

**[Name des Autohauses], [Anschrift]**
– nachfolgend **Verantwortlicher** –

und

**[Name des Betreibers], [Anschrift]**
– nachfolgend **Auftragsverarbeiter** –

## § 1 Gegenstand und Dauer

(1) Der Auftragsverarbeiter stellt dem Verantwortlichen das Intranet **AHOI**
als Software zur Verfügung und betreibt es. Dabei verarbeitet er
personenbezogene Daten der Beschäftigten des Verantwortlichen.

(2) Die Laufzeit entspricht der Laufzeit des Hauptvertrags vom [Datum].

## § 2 Art, Zweck und Umfang

(1) **Art der Verarbeitung:** Erheben, Speichern, Ordnen, Auslesen, Verwenden,
Löschen – im Rahmen des Betriebs der Anwendung.

(2) **Zweck:** Betrieb eines Intranets für den Betriebsalltag des
Verantwortlichen: Aushänge, Bestellungen mit Freigabe, Anträge,
Serviceanfragen, Einarbeitung und weitere vom Verantwortlichen eingeschaltete
Module.

(3) **Kategorien betroffener Personen:** Beschäftigte des Verantwortlichen;
vereinzelt Dritte, soweit der Verantwortliche sie einträgt (etwa bei der
Übergabe einer Fundsache).

(4) **Kategorien personenbezogener Daten:** Stammdaten, Kontaktdaten,
Organisationszuordnung, Rollen und Rechte, Vorgangsdaten der eingeschalteten
Module, Protokolldaten.

(5) **Besondere Kategorien (Art. 9):** Soweit der Verantwortliche das Modul
_Abwesenheiten_ einschaltet, wird die Abwesenheitsart „krank" verarbeitet.
Diagnosen und Atteste werden **nicht** verarbeitet. Weitere besondere
Kategorien können entstehen, wenn der Verantwortliche die Module _Umfragen_
oder _Essensbestellung_ entsprechend nutzt.

## § 3 Weisungsbindung

(1) Der Auftragsverarbeiter verarbeitet die Daten ausschließlich auf
dokumentierte Weisung des Verantwortlichen.

(2) Hält er eine Weisung für rechtswidrig, teilt er dies unverzüglich mit und
darf die Ausführung bis zur Klärung aussetzen.

(3) Weisungen sind in Textform zu erteilen. Mündliche Weisungen sind
unverzüglich in Textform zu bestätigen.

## § 4 Technische und organisatorische Maßnahmen (Art. 32)

Der Auftragsverarbeiter unterhält mindestens die in **Anlage 1** beschriebenen
Maßnahmen. Änderungen dürfen das Schutzniveau nicht senken und sind zu
dokumentieren.

## § 5 Unterauftragsverarbeiter

(1) Der Verantwortliche genehmigt die in **Anlage 2** genannten
Unterauftragsverarbeiter.

(2) Weitere Unterauftragsverarbeiter teilt der Auftragsverarbeiter mit einer
Frist von [30] Tagen vorab mit. Der Verantwortliche kann binnen [14] Tagen
widersprechen; widerspricht er, kann jede Partei den Vertrag kündigen.

(3) Der Auftragsverarbeiter verpflichtet Unterauftragsverarbeiter auf dieselben
Pflichten.

## § 6 Unterstützung des Verantwortlichen

Der Auftragsverarbeiter unterstützt den Verantwortlichen insbesondere bei

- Anfragen betroffener Personen (Art. 12–23). Die Anwendung erzeugt die
  Auskunft nach Art. 15 selbsttätig als Datei; die **inhaltliche Prüfung**
  – auch der Freitexte, die eine Person nennen, ohne dass ein Feld darauf
  zeigt – obliegt dem Verantwortlichen.
- der Meldung von Verletzungen (Art. 33, 34). Der Auftragsverarbeiter meldet
  dem Verantwortlichen **unverzüglich, spätestens binnen 24 Stunden** nach
  Kenntnis.
- Folgenabschätzung und vorheriger Konsultation (Art. 35, 36).

## § 7 Löschung und Rückgabe

(1) Nach Vertragsende löscht oder übergibt der Auftragsverarbeiter alle Daten
nach Wahl des Verantwortlichen. Die Wahl ist binnen [30] Tagen zu treffen.

(2) Sicherungskopien werden binnen [90] Tagen nach ihrem üblichen Zyklus
gelöscht.

(3) **Hinweis:** Der Verantwortliche unterliegt eigenen
Aufbewahrungspflichten – freigegebene Bestellungen sind nach § 147 AO und
§ 257 HGB zehn Jahre aufzubewahren. Eine vollständige Löschung kann diesen
Pflichten widersprechen; die Anwendung bietet dafür die **Anonymisierung**.

## § 8 Nachweise und Kontrolle

(1) Der Auftragsverarbeiter weist die Einhaltung auf Anforderung nach.

(2) Der Verantwortliche darf nach Ankündigung mit angemessener Frist
kontrollieren oder kontrollieren lassen.

## § 9 Vertraulichkeit

Die mit der Verarbeitung befassten Personen sind zur Vertraulichkeit
verpflichtet (Art. 28 Abs. 3 lit. b). Der Nachweis ist auf Anforderung
vorzulegen.

## § 10 Ort der Verarbeitung

Die Verarbeitung findet ausschließlich in [der Bundesrepublik Deutschland / der
Europäischen Union] statt. Eine Verarbeitung in einem Drittland bedarf der
vorherigen Zustimmung in Textform und einer Grundlage nach Kapitel V DSGVO.

---

[Ort, Datum] · Verantwortlicher &nbsp;&nbsp;&nbsp;&nbsp; [Ort, Datum] · Auftragsverarbeiter

---

## Anlage 1 – Technische und organisatorische Maßnahmen

| Bereich            | Maßnahme in AHOI                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Zugangskontrolle   | Passwort als bcrypt-Hash (Kostenfaktor 12); Sperre nach fünf Fehlversuchen; Sitzungstoken im httpOnly-Cookie                   |
| Zugriffskontrolle  | Rechte je Rolle, **serverseitig** geprüft; Prüfungen im Browser sind nur Komfort                                               |
| Trennungskontrolle | Mandantentrennung in der Datenschicht, fail-closed: ohne Mandantenkontext scheitert der Zugriff hart                           |
| Eingabekontrolle   | Audit-Log über alle fachlich relevanten Aktionen mit Person und Zeitpunkt                                                      |
| Verschlüsselung    | Übertragung per TLS; hinterlegte Geheimnisse mit AES-256-GCM                                                                   |
| Verfügbarkeit      | tägliche Sicherung, Wiederherstellung mit Probelauf geprobt [Abzug auf ein zweites System: **noch offen**, siehe Hauptvertrag] |
| Löschung           | Fristen je Datenart, durchgesetzt von einem eigenen Lauf                                                                       |
| Überprüfung        | automatische Prüfpipeline bei jeder Änderung                                                                                   |

> **Offen und dem Verantwortlichen bekannt:** Die Sicherungen liegen bislang auf
> derselben Maschine. Das schützt gegen Bedienfehler, nicht gegen deren Ausfall.

## Anlage 2 – Unterauftragsverarbeiter

| Unternehmen     | Leistung                             | Ort    |
| --------------- | ------------------------------------ | ------ |
| [Hoster]        | Betrieb der Server und der Datenbank | [Land] |
| [Mailversender] | Zustellung von Benachrichtigungen    | [Land] |
