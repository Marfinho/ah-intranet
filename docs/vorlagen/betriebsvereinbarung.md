# Betriebsvereinbarung zum Intranet AHOI (Entwurf)

> **Entwurf für das Gespräch, kein Ergebnis.** Eine Betriebsvereinbarung wird
> verhandelt, nicht vorgelegt. Dieser Text nennt die Punkte, über die zu reden
> ist, und macht dort Vorschläge, wo der Entwurf der Software eine Richtung
> vorgibt. Platzhalter in `[eckigen Klammern]`.

zwischen der **[Firma]** und dem **Betriebsrat der [Firma]**

## § 1 Gegenstand

Diese Vereinbarung regelt Einführung, Anwendung und Änderung des Intranets
**AHOI** einschließlich der eingeschalteten Fachmodule.

## § 2 Geltungsbereich

Alle Beschäftigten im Sinne des § 5 BetrVG. [Leitende Angestellte nach § 5
Abs. 3 BetrVG sind ausgenommen.]

## § 3 Zweck – und was ausgeschlossen ist

(1) AHOI dient der Organisation des Betriebsalltags: Aushänge, Bestellungen,
Anträge, Serviceanfragen, Einarbeitung [und weitere nach § 5].

(2) **Eine Verhaltens- oder Leistungskontrolle ist ausgeschlossen.** Die in der
Anwendung entstehenden Daten dürfen **nicht** zur Bewertung von Leistung oder
Verhalten einzelner Beschäftigter ausgewertet werden.

(3) Erkenntnisse, die unter Verstoß gegen Absatz 2 gewonnen werden, dürfen
**nicht** zur Begründung personeller oder disziplinarischer Maßnahmen dienen.
Die Betriebsparteien vereinbaren insoweit ein **Verwertungsverbot**.

## § 4 Verarbeitete Daten

Welche Daten je Modul entstehen, wie lange sie bleiben und warum, ergibt sich
aus **Anlage 1**. Diese entspricht dem Rechtsregister der Software
(`docs/recht.md`) und der Fristenliste in der Anwendung, einsehbar unter
_Administration → Datenschutz_.

## § 5 Einschalten von Modulen

(1) Ein Modul wird erst eingeschaltet, nachdem der Betriebsrat zugestimmt hat.
Die Zustimmung wird in **Anlage 2** dokumentiert.

(2) Für folgende Module gelten **zusätzliche** Regelungen:

- **Schichtplan** – Anlage 3
- **Abwesenheiten** – Anlage 4
- **Umfragen** – Anlage 5
- **Audit-Log** – Anlage 6

(3) Module mit dem Reifegrad _Erprobung_ werden nur nach gesonderter
Verständigung und befristet eingeschaltet.

## § 6 Zugriffsrechte

(1) Der Zugriff folgt dem Grundsatz der Erforderlichkeit.

(2) **Änderungen an Rollen, die Zugriff auf Abwesenheiten eröffnen, sind dem
Betriebsrat vorher mitzuteilen.** Grund: Abwesenheiten enthalten die Angabe
„krank" und damit Gesundheitsdaten.

(3) Eine aktuelle Übersicht der Rollen und ihrer Rechte ist dem Betriebsrat auf
Verlangen vorzulegen; die Anwendung stellt sie unter _Administration → Rollen &
Rechte_ dar.

## § 7 Auswertungen

(1) Auswertungen über mehrere Personen sind nur **anonymisiert oder
aggregiert** zulässig.

(2) Eine personenbezogene Auswertung ist **nur bei konkretem Verdacht** einer
erheblichen Pflichtverletzung zulässig, nur nach vorheriger Unterrichtung des
Betriebsrats und nur im **Vier-Augen-Prinzip**.

(3) Die betroffene Person wird unterrichtet, sobald der Zweck der Aufklärung
das zulässt.

## § 8 Rechte des Betriebsrats

(1) Der Betriebsrat erhält [einen lesenden Zugang / Auskunft auf Verlangen] zu
den Konfigurationen nach § 6 Abs. 3.

(2) Vor Änderungen, die den Umfang der erhobenen Daten erweitern, ist der
Betriebsrat zu beteiligen. Das gilt auch für **Aktualisierungen der Software**,
die neue Datenfelder einführen.

(3) § 79a BetrVG bleibt unberührt.

## § 9 Schulung und Unterrichtung

(1) Die Beschäftigten werden vor der Einführung über Zweck, Umfang und Grenzen
unterrichtet; die Information nach Art. 13 DSGVO wird ausgehändigt.

(2) [Es findet eine Einweisung von [Dauer] statt.]

## § 10 Laufzeit

(1) Die Vereinbarung tritt am [Datum] in Kraft.

(2) Sie kann mit einer Frist von [drei] Monaten zum Monatsende gekündigt
werden. **Eine Nachwirkung nach § 77 Abs. 6 BetrVG wird [vereinbart / nicht
vereinbart].**

(3) Die Betriebsparteien überprüfen die Vereinbarung erstmals nach [zwölf]
Monaten.

---

[Ort, Datum] · Arbeitgeber &nbsp;&nbsp;&nbsp;&nbsp; [Ort, Datum] · Betriebsrat

---

## Anlage 3 – Schichtplan (Vorschlag)

1. Der Schichtplan wird [vier] Wochen im Voraus veröffentlicht.
2. Ein **Diensttausch** kommt nur zustande, wenn **beide** Beschäftigten
   zustimmen **und** die Führungskraft freigibt. Die Software setzt diese
   zweistufige Folge technisch durch; ein Tausch gegen den Willen einer der
   beiden Personen ist nicht möglich.
3. **Die Einhaltung des Arbeitszeitgesetzes bleibt Aufgabe des Arbeitgebers.**
   Die Software weist Doppelbelegungen ab, prüft aber **nicht** die Ruhezeit
   von elf Stunden (§ 5 ArbZG), die Höchstarbeitszeit (§ 3 ArbZG) und die
   Pausen (§ 4 ArbZG).
4. Der Betriebsrat erhält Zugang zum Schichtplan.
5. Der Schichtplan ist **keine Arbeitszeiterfassung**; Beginn und Ende der
   tatsächlichen Arbeitszeit werden [in … ] erfasst.

## Anlage 4 – Abwesenheiten (Vorschlag)

1. Erfasst werden **Art und Zeitraum**. **Diagnosen und Atteste werden nicht in
   AHOI gespeichert.**
2. Zugriff nur für Personen mit Freigabeberechtigung; die Liste ist dem
   Betriebsrat auf Verlangen vorzulegen.
3. Die Angabe „krank" ist ein Gesundheitsdatum. Eine Auswertung von
   Krankheitszeiten einzelner Personen ist **unzulässig**; aggregierte
   Kennzahlen sind zulässig, sofern keine Rückschlüsse auf Einzelne möglich
   sind [Mindestgruppengröße: [5]].

## Anlage 5 – Umfragen (Vorschlag)

1. **Umfragen in AHOI sind nicht anonym.** Jede Stimme trägt die Kennung der
   abstimmenden Person. Das ist den Beschäftigten bei jeder Umfrage sichtbar
   mitzuteilen.
2. Unzulässig sind Fragen nach Gesundheit, Religion, Weltanschauung,
   Gewerkschaftszugehörigkeit, sexueller Orientierung und politischer Meinung.
3. Befragungen, deren Wert von der Anonymität abhängt – insbesondere
   Stimmungsbilder und Rückmeldungen zu Vorgesetzten – werden **nicht** über
   AHOI durchgeführt.

## Anlage 6 – Audit-Log (Vorschlag)

1. Zweck: Nachvollziehbarkeit und IT-Sicherheit. **Nicht:** Leistungskontrolle.
2. Aufbewahrung: [drei] Jahre.
3. Zugriff nur mit dem Recht `audit.read`; die Trägerinnen und Träger sind dem
   Betriebsrat zu benennen.
4. Auswertungen nur nach § 7 dieser Vereinbarung.
