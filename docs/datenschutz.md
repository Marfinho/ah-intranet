# Datenschutz

Diese Unterlage beschreibt, welche personenbezogenen Daten das Intranet
verarbeitet, wie lange sie bleiben und wie Betroffenenrechte umgesetzt werden.

> **Kein Rechtsrat.** Die Fristen und Bewertungen hier sind begründete Vorgaben
> der Anwendung. Vor dem Produktivbetrieb gehören sie mit der Rechtsberatung und
> der Arbeitnehmervertretung des jeweiligen Hauses abgeglichen. Die Anwendung
> macht die Festlegung technisch durchsetzbar – sie trifft sie nicht.

## Verantwortlichkeit bei mehreren Häusern

Jedes Autohaus ist eigener Verantwortlicher im Sinne der DSGVO für die Daten
seiner Beschäftigten. Der Betreiber der Installation ist Auftragsverarbeiter und
braucht mit jedem Haus einen Vertrag nach Art. 28 DSGVO.

Technisch trägt das die Mandantentrennung: Daten eines Hauses sind für ein
anderes nicht erreichbar (siehe `CLAUDE.md`, Abschnitt Mandantenfähigkeit). Die
Plattformverwaltung des Betreibers kann Häuser anlegen und sperren – sie hat
**keinen** Zugriff auf deren Inhalte.

## Verarbeitungsverzeichnis (Art. 30 DSGVO)

Vorlage je Haus auszufüllen und zu unterzeichnen.

| Feld                     | Inhalt                                                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Verantwortlicher         | _<Firma, Anschrift, Geschäftsführung>_                                                                                                                       |
| Datenschutzbeauftragte:r | _<Name, Kontakt>_                                                                                                                                            |
| Auftragsverarbeiter      | _<Betreiber der Installation, Hosting, ggf. Druckdienstleister der Visitenkarten>_                                                                           |
| Zweck                    | Innerbetriebliche Information und Organisation: Aushänge, Bestellwesen, Freigaben, Serviceanfragen, Abwesenheiten, Raum- und Fahrzeugbuchungen, Einarbeitung |
| Rechtsgrundlage          | Art. 6 Abs. 1 lit. b DSGVO i. V. m. § 26 BDSG (Durchführung des Beschäftigungsverhältnisses); Art. 6 Abs. 1 lit. c für aufbewahrungspflichtige Unterlagen    |
| Betroffene Personen      | Beschäftigte des Hauses                                                                                                                                      |
| Datenkategorien          | siehe Tabelle unten                                                                                                                                          |
| Empfänger                | Vorgesetzte und Fachbereiche im Rahmen der Rollen; externe Dienstleister nur bei ausgelösten Sammelbestellungen                                              |
| Drittlandübermittlung    | keine                                                                                                                                                        |
| Löschfristen             | siehe Tabelle unten, technisch umgesetzt in `packages/shared/src/retention.ts`                                                                               |
| Technische Maßnahmen     | siehe Abschnitt „Technische und organisatorische Maßnahmen"                                                                                                  |

## Datenkategorien und Fristen

Die Fristen stehen als einzige Quelle der Wahrheit in
`packages/shared/src/retention.ts`. Die Adminoberfläche zeigt sie unter
**Administration → Datenschutz**, der Aufräumlauf setzt sie durch. Eine Änderung
dort wirkt sofort in Oberfläche, Lauf und Auskunft – diese Tabelle ist die
Erläuterung, nicht die Quelle.

| Datenart                   | Frist    | Behandlung      | Begründung (Kurzform)                                               |
| -------------------------- | -------- | --------------- | ------------------------------------------------------------------- |
| Benachrichtigungen         | 90 Tage  | wird gelöscht   | reiner Zustellweg ohne Beweiswert                                   |
| Lesebestätigungen          | 180 Tage | wird gelöscht   | Verhaltensdaten, taugen am ehesten zur Leistungskontrolle           |
| Raumbuchungen              | 1 Jahr   | wird gelöscht   | kein handels- oder steuerrechtlicher Bezug                          |
| Serviceanfragen            | 2 Jahre  | wird gelöscht   | wiederkehrende Störungen bleiben erkennbar                          |
| Audit-Log                  | 3 Jahre  | wird gelöscht   | regelmäßige Verjährung; länger wäre Vorratsdatenhaltung             |
| Fahrzeugbuchungen          | 3 Jahre  | wird gelöscht   | Schäden und Verstöße müssen nachvollziehbar bleiben                 |
| Abwesenheiten              | 3 Jahre  | wird gelöscht   | Urlaubsansprüche verjähren in drei Jahren; § 16 Abs. 2 ArbZG        |
| Bestellungen und Freigaben | 10 Jahre | bleibt erhalten | § 147 AO, § 257 HGB                                                 |
| Personalstammdaten         | 10 Jahre | bleibt erhalten | Durchführung des Beschäftigungsverhältnisses, danach Lohnunterlagen |

Serviceanfragen werden nur gelöscht, wenn sie den Status **gelöst** haben – ein
offener Vorgang verschwindet nicht, weil er alt ist.

## Auskunft (Art. 15 DSGVO)

**Administration → Datenschutz → Auskunft** erzeugt eine JSON-Datei mit allen
Datensätzen, die einer Person über ein Datenfeld zugeordnet sind: Stammdaten,
Rollen, Bestellungen, Abwesenheiten, Serviceanfragen samt Kommentaren, Raum- und
Fahrzeugbuchungen, Benachrichtigungen und protokollierte Aktionen.

Die Datei nennt zusätzlich die **Grenze des Automatischen**: Freitexte anderer
Personen können die betroffene Person namentlich erwähnen, ohne dass ein Feld
darauf zeigt (Kommentare, Ticketbeschreibungen, Wiki-Artikel). Diese Stellen sind
in der Auskunft aufgeführt und vom Haus durchzusehen. Die Anwendung behauptet
nicht, das maschinell zu lösen.

## Löschung (Art. 17 DSGVO)

Eine Löschung auf Verlangen wird als **Anonymisierung** umgesetzt.

**Warum nicht hart löschen:** Eine freigegebene Bestellung ist eine
buchungsrelevante Unterlage und muss zehn Jahre nachvollziehbar bleiben. Ein
`DELETE` auf das Konto würde sie mitreißen oder die Freigabeentscheidung ihres
Urhebers berauben. Art. 17 Abs. 3 lit. b DSGVO nimmt genau solche Pflichten von
der Löschung aus.

Was passiert:

- **Wirklich gelöscht:** Benachrichtigungen, Lesebestätigungen, Ideen- und
  Umfragestimmen – reine Aktivitätsspuren ohne Beweiswert.
- **Anonymisiert:** Name, Benutzername, E-Mail, Telefon, Funktion, Zuordnung zu
  Standort, Abteilung und Vorgesetzten. Das Kennwort wird unbrauchbar, laufende
  Sitzungen enden sofort, alle Rollen werden entzogen.
- **Erhalten, aber ohne Personenbezug:** Bestellungen, Freigaben, Serviceanfragen
  und Protokolleinträge. Sie zeigen auf ein Konto, das keine Identität mehr trägt.
- **Von Hand durchzusehen:** Freitexte, wie oben beschrieben.

Der Vorgang ist unumkehrbar, verlangt eine Bestätigung und einen festgehaltenen
Anlass, und landet selbst im Audit-Log. Das eigene Konto lässt sich nicht
anonymisieren – sonst stünde niemand mehr bereit, den Vorgang zu korrigieren.

## Aufbewahrungslauf

```bash
pnpm --filter api build
pnpm --filter api aufbewahrung:vorschau   # zählt nur
pnpm --filter api aufbewahrung            # löscht
```

Im Regelbetrieb per Cron, nicht als Hintergrundaufgabe der API – bei mehreren
API-Instanzen liefe eine eingebaute Zeitsteuerung mehrfach:

```cron
0 3 * * *  cd /opt/ah-intranet/apps/api && node dist/scripts/aufbewahrung.js >> /var/log/ah-intranet/aufbewahrung.log 2>&1
```

Der Lauf geht Haus für Haus vor und arbeitet jeweils im Mandantenkontext; er kann
kein fremdes Haus treffen.

## Mitbestimmung

Ein Intranet mit Tickets, Abwesenheiten und einem Audit-Log ist eine technische
Einrichtung, die zur Überwachung von Verhalten und Leistung **geeignet** ist –
nach § 87 Abs. 1 Nr. 6 BetrVG ist die Einführung damit mitbestimmungspflichtig,
unabhängig davon, ob eine Überwachung beabsichtigt ist.

Vor der Einführung in einem Haus mit Betriebsrat zu klären:

- **Betriebsvereinbarung** über Zweck, Umfang, Auswertung und Fristen.
- **Was ausgewertet werden darf und was nicht.** Das Audit-Log ist als Nachweis
  von Änderungen an Rechten und Freigaben gedacht, nicht als Tätigkeitsnachweis.
  Eine ausdrückliche Zweckbindung gehört in die Vereinbarung.
- **Lesebestätigungen** sind der heikelste Punkt: sie zeigen, wer wann was gelesen
  hat. Deshalb haben sie die kürzeste Frist. Ein Haus kann sich auch gegen das
  Merkmal entscheiden – es hängt am Modul „Aktuelles".
- **Rollen und Einsicht.** Wer Freigaben und Abwesenheiten sieht, ergibt sich aus
  den Rollen; die Zuordnung gehört dokumentiert.
- **Auskunftsweg für Beschäftigte**: an wen man sich wendet und in welcher Frist.

## Technische und organisatorische Maßnahmen

- Kennwörter als bcrypt-Hash (Kostenfaktor 12), Kontosperre nach fünf
  Fehlversuchen, Sitzung im httpOnly-Cookie.
- Rollenprüfung serverseitig aus dem Token, nie aus Anfragedaten.
- Mandantentrennung auf Ebene des Datenzugriffs, fail-closed.
- Audit-Log über alle fachlich relevanten Aktionen.
- Sicherung und Wiederherstellung: siehe [`betrieb.md`](betrieb.md).

## Offene Punkte

- Auftragsverarbeitungsvertrag zwischen Betreiber und Haus (Vorlage fehlt).
- Datenschutz-Folgenabschätzung, falls ein Haus die Auswertung über das hier
  beschriebene Maß hinaus ausweiten will.
- Löschung von Anhängen und Dateien: das Intranet verweist auf Dokumente im DMS,
  hält sie aber nicht selbst – deren Fristen liegen beim DMS.
