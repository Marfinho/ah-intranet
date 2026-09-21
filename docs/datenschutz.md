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

| Feld                     | Inhalt                                                                                                                                                                                                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Verantwortlicher         | _<Firma, Anschrift, Geschäftsführung>_                                                                                                                                                                                                                                                      |
| Datenschutzbeauftragte:r | _<Name, Kontakt>_                                                                                                                                                                                                                                                                           |
| Auftragsverarbeiter      | _<Betreiber der Installation, Hosting, ggf. Druckdienstleister der Visitenkarten>_                                                                                                                                                                                                          |
| Zweck                    | Innerbetriebliche Information und Organisation: Aushänge, Bestellwesen, Freigaben, Serviceanfragen, Abwesenheiten, Raumbuchungen, Schichtplanung, Verwahrung, Essensbestellung, Einarbeitung                                                                                                |
| Rechtsgrundlage          | Art. 6 Abs. 1 lit. b DSGVO i. V. m. § 26 Abs. 1 BDSG (Durchführung des Beschäftigungsverhältnisses); Art. 6 Abs. 1 lit. c für aufbewahrungspflichtige Unterlagen; für Krankmeldungen **zusätzlich** Art. 9 Abs. 2 lit. b DSGVO i. V. m. § 26 Abs. 3 BDSG – siehe Abschnitt Gesundheitsdaten |
| Betroffene Personen      | Beschäftigte des Hauses                                                                                                                                                                                                                                                                     |
| Datenkategorien          | siehe Tabelle unten                                                                                                                                                                                                                                                                         |
| Empfänger                | Vorgesetzte und Fachbereiche im Rahmen der Rollen; externe Dienstleister nur bei ausgelösten Sammelbestellungen                                                                                                                                                                             |
| Drittlandübermittlung    | keine                                                                                                                                                                                                                                                                                       |
| Löschfristen             | siehe Tabelle unten, technisch umgesetzt in `packages/shared/src/retention.ts`                                                                                                                                                                                                              |
| Technische Maßnahmen     | siehe Abschnitt „Technische und organisatorische Maßnahmen"                                                                                                                                                                                                                                 |

## Datenkategorien und Fristen

Die Fristen stehen als einzige Quelle der Wahrheit in
`packages/shared/src/retention.ts`. Die Adminoberfläche zeigt sie unter
**Administration → Datenschutz**, der Aufräumlauf setzt sie durch. Eine Änderung
dort wirkt sofort in Oberfläche, Lauf und Auskunft – diese Tabelle ist die
Erläuterung, nicht die Quelle.

| Datenart                                  | Frist    | Behandlung            | Begründung (Kurzform)                                                                                                 |
| ----------------------------------------- | -------- | --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Benachrichtigungen                        | 90 Tage  | wird gelöscht         | reiner Zustellweg ohne Beweiswert                                                                                     |
| Lesebestätigungen                         | 180 Tage | wird gelöscht         | Verhaltensdaten, taugen am ehesten zur Leistungskontrolle                                                             |
| Raumbuchungen                             | 1 Jahr   | wird gelöscht         | kein handels- oder steuerrechtlicher Bezug                                                                            |
| Serviceanfragen                           | 2 Jahre  | wird gelöscht         | wiederkehrende Störungen bleiben erkennbar                                                                            |
| Audit-Log                                 | 3 Jahre  | wird gelöscht         | regelmäßige Verjährung; länger wäre Vorratsdatenhaltung                                                               |
| Abwesenheiten ohne Krankmeldung           | 3 Jahre  | wird gelöscht         | Urlaubsansprüche verjähren in drei Jahren; § 16 Abs. 2 ArbZG                                                          |
| Krankmeldungen                            | 1 Jahr   | wird gelöscht         | Gesundheitsdatum nach Art. 9; die Begründung der übrigen Abwesenheiten trägt hier nicht                               |
| Bestellungen und Freigaben                | 10 Jahre | bleibt erhalten       | § 147 AO, § 257 HGB                                                                                                   |
| Personalstammdaten, aktive Konten         | –        | bleibt erhalten       | Solange das Beschäftigungsverhältnis besteht, ist die Verarbeitung dafür erforderlich                                 |
| Personalstammdaten, ausgeschiedene Konten | 3 Jahre  | **wird anonymisiert** | Mit dem Austritt endet der Zweck nach § 26 Abs. 1 BDSG; Bestellungen und Freigaben bleiben als Vorgang ohne Identität |

Serviceanfragen werden nur gelöscht, wenn sie den Status **gelöst** haben – ein
offener Vorgang verschwindet nicht, weil er alt ist.

Für ausgeschiedene Konten beginnt die Frist, wenn das Konto auf **inaktiv**
gesetzt wird. Der Zeitpunkt steht als eigenes Feld am Konto und nicht an
`updatedAt` – sonst ließe jede Nebensächlichkeit die Frist von vorn beginnen.
Konten, die vor Einführung dieser Regel deaktiviert wurden, tragen keinen
solchen Zeitpunkt und bleiben unberührt; sie sind von Hand anzustoßen
(`pnpm --filter api anonymisieren`). Eine Frist zu raten wäre schlechter, als
die Lücke zu benennen.

## Gesundheitsdaten (Art. 9 DSGVO)

Eine Krankmeldung im Intranet enthält keine Diagnose. Die **Tatsache** der
Arbeitsunfähigkeit ist aber bereits ein Gesundheitsdatum nach Art. 9 Abs. 1
DSGVO. Daraus folgt dreierlei:

- **Eigene Rechtsgrundlage.** Art. 6 allein trägt nicht; es braucht zusätzlich
  Art. 9 Abs. 2 lit. b i. V. m. § 26 Abs. 3 BDSG (Ausübung von Rechten aus dem
  Arbeitsrecht). Das steht so im Verarbeitungsverzeichnis oben.
- **Eigene, kürzere Frist.** Ein Jahr statt drei. Die Begründung der übrigen
  Abwesenheiten – Verjährung von Urlaubsansprüchen – passt auf einen
  Krankheitstag nicht.
- **Engerer Kreis.** Krankmeldungen sieht, wer für die betreffende Person
  `absences.approve` trägt, und wer `absences.viewAll` hat. Das zweite Recht
  gibt Einblick in die Krankmeldungen des **ganzen Hauses**; es gehört in der
  Betriebsvereinbarung benannt und sollte bei der Personalverwaltung bleiben.

## Auskunft (Art. 15 DSGVO)

Es gibt zwei Wege:

- **Selbstauskunft:** **Profil → Meine Daten → Auskunft herunterladen**. Ohne
  Antrag, ohne Recht, ohne Umweg über die Verwaltung – Art. 15 ist ein Recht der
  betroffenen Person. Die Auskunft betrifft immer das angemeldete Konto; einen
  Parameter für eine fremde Kennung gibt es bewusst nicht.
- **Auskunft durch die Verwaltung:** **Administration → Datenschutz → Auskunft**,
  für schriftliche Anträge und für ausgeschiedene Konten.

Beide Wege erzeugen dieselbe JSON-Datei mit allen Datensätzen, die der Person
über ein Datenfeld zugeordnet sind: Stammdaten, Rollen, Bestellungen und
Bestellkommentare, getroffene Freigabeentscheidungen, Abwesenheiten,
Serviceanfragen samt Kommentaren, Beitragskommentare, Lesebestätigungen,
verfasste Wiki-Artikel, eingereichte Ideen und Umfragen samt abgegebener
Stimmen, organisierte Termine, verantwortete Dokumente, Raumbuchungen,
Schichten und Diensttausch, Verwahrungsvorgänge, Essensbestellungen,
Einarbeitung, Benachrichtigungen und protokollierte Aktionen.

**Jeder Abruf wird protokolliert** (`privacy.auskunft` im Audit-Log). Er ist der
weitreichendste Lesezugriff der Anwendung – der gesamte Datenbestand einer
Person in einer Datei –, und ein solcher Zugriff darf nicht spurlos bleiben
(Art. 5 Abs. 2 DSGVO).

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
- **Erhalten _mit_ Namen – die eine Ausnahme:** Das **Audit-Log** trägt den
  Benutzernamen der handelnden Person als Text, und der Eintrag über die
  Anonymisierung selbst nennt zusätzlich den bisherigen Namen. Ohne das wäre der
  Vorgang nicht mehr belegbar – ein Protokoll, das sich selbst bereinigt, ist
  keines. Gedeckt ist das von Art. 17 Abs. 3 lit. b und lit. e DSGVO. Die
  Einträge verschwinden mit der Frist des Audit-Logs nach **drei Jahren**; bis
  dahin ist der Name dort lesbar. Wer eine betroffene Person über die Löschung
  unterrichtet, muss das benennen.
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

**Der Lauf wird überwacht.** Jeder Durchgang schreibt einen Audit-Eintrag –
auch der per Cron, der das früher nicht tat. **Administration → Datenschutz**
zeigt oben, wann zuletzt einer lief, und färbt den Hinweis rot, sobald der
letzte mehr als **48 Stunden** zurückliegt. Das ist der wunde Punkt dieser
Anwendung: Bleibt der Lauf aus, greift **keine einzige** der oben genannten
Fristen – und ohne diese Anzeige fiele es niemandem auf.

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
- **Auskunftsweg für Beschäftigte**: Die Anwendung bietet ihn selbst an
  (Profil → Meine Daten). Zu klären bleibt, an wen man sich wendet, wenn die
  Datei Fragen aufwirft, und in welcher Frist geantwortet wird.
- **Das Anfrageprotokoll.** Die Anwendung schreibt je Anfrage eine Zeile mit
  Benutzername, Route, Status und Dauer auf die Standardausgabe. Über einen
  Arbeitstag ergibt das lückenlos, wer wann welche Seite aufgerufen hat – als
  Verhaltensdatum aussagekräftiger als die Lesebestätigungen. Es gehört
  ausdrücklich in die Vereinbarung, mit Zweckbindung (Störungssuche und
  Sicherheitsvorfälle, keine Leistungskontrolle) und mit einer Frist. **Die
  Frist muss die Umgebung durchsetzen**, nicht die Anwendung: die Zeilen gehen
  an die Protokolleinsammlung des Betriebs, außerhalb der Reichweite von
  `retention.ts`. Vorgabe dieses Projekts: dieselben drei Jahre wie beim
  Audit-Log, eher kürzer.
- **Krankmeldungen.** Wer `absences.viewAll` bekommt, sieht die Krankmeldungen
  des ganzen Hauses. Die Zuweisung dieses Rechts gehört dokumentiert.

## Technische und organisatorische Maßnahmen

- Kennwörter als bcrypt-Hash (Kostenfaktor 12), Kontosperre nach fünf
  Fehlversuchen, Sitzung im httpOnly-Cookie.
- Rollenprüfung serverseitig aus dem Token, nie aus Anfragedaten.
- Mandantentrennung auf Ebene des Datenzugriffs, fail-closed.
- Audit-Log über alle fachlich relevanten Aktionen, einschließlich jedes
  Auskunftsabrufs. Fehlgeschlagene Einträge werden gezählt und stehen im
  Healthcheck – ein Protokoll mit unbemerkten Lücken ist kein Nachweis.
- Vier-Augen-Prinzip bei Freigaben: die eigene Bestellung lässt sich nicht selbst
  genehmigen.
- Startpasswörter aus dem kryptographischen Zufallsgenerator des Betriebssystems.
- Sitzungscookie mit `__Host-`-Präfix im Produktivbetrieb; Content-Security-Policy
  und HSTS vor der Oberfläche.
- Sicherung und Wiederherstellung: siehe [`betrieb.md`](betrieb.md).

## Offene Punkte

- Auftragsverarbeitungsvertrag zwischen Betreiber und Haus (Vorlage fehlt).
- **Datenschutz-Folgenabschätzung (Art. 35 DSGVO) – vor der Einführung, nicht
  nur im Ausweitungsfall.** Die frühere Fassung dieser Unterlage stellte sie
  unter Vorbehalt. Das ist zu knapp: Verarbeitet werden Beschäftigtendaten,
  darunter Gesundheitsdaten nach Art. 9, in einem System, das mit Audit-Log,
  Lesebestätigungen, Anfrageprotokoll und Schichtplanung zur Verhaltens- und
  Leistungskontrolle **geeignet** ist, betrieben durch einen
  Auftragsverarbeiter. Das trifft mehrere Kriterien der Listen der
  Aufsichtsbehörden schon im hier beschriebenen Umfang. Der Aufwand ist
  überschaubar – diese Unterlage ist der Entwurf.
- **Protokollfrist in der Zielumgebung.** Siehe Mitbestimmung: die Frist für das
  Anfrageprotokoll hängt an der Protokolleinsammlung des Betriebs und ist dort
  einzustellen.
- Löschung von Anhängen und Dateien: das Intranet verweist auf Dokumente im DMS,
  hält sie aber nicht selbst – deren Fristen liegen beim DMS.
