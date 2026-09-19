# Ausrollen

Was zu entscheiden ist, bevor AHOI irgendwo läuft. Diese Seite trifft keine
Entscheidung – sie stellt die Fragen so, dass sie zu beantworten sind.

## Der Stand

Alles ist gebaut, nichts läuft. Ohne laufende Installation gibt es keine
Erprobung, keine Rückmeldung und keinen Kunden. Das ist derzeit der einzige
echte Engpass.

## Drei Aufstellungen

Größenordnungen für ein bis fünf Häuser. Preise sind Hausnummern und gehören
beim Anbieter geprüft.

| Aufstellung                       | Was es ist                                                                      | Monatlich | Aufwand einmalig | Wenn nachts etwas ausfällt                        |
| --------------------------------- | ------------------------------------------------------------------------------- | --------- | ---------------- | ------------------------------------------------- |
| **Ein Server**                    | Eine Maschine, Docker Compose, Datenbank daneben                                | 20–40 €   | 1–2 Tage         | Sie                                               |
| **Server + verwaltete Datenbank** | Anwendung im Container, Datenbank beim Anbieter mit Sicherung und Ausfallschutz | 60–120 €  | 2–3 Tage         | Sie für die Anwendung, Anbieter für die Datenbank |
| **Plattform**                     | Anbieter nimmt Container entgegen und betreibt sie                              | 50–150 €  | 1 Tag            | Anbieter, in Grenzen                              |

**Empfehlung für den Anfang: ein Server, zwei Instanzen.** Eine für die
Produktion, eine für die Erprobung – beide auf derselben Maschine, getrennte
Datenbanken. Das kostet fast nichts extra und trennt genau dort, wo es weh täte.
Sobald das erste zahlende Haus produktiv ist, wandert die Datenbank in die
verwaltete Variante: Sicherung und Ausfallschutz sind dann keine Nebentätigkeit
mehr.

## Was zu entscheiden ist

| Frage                    | Warum sie zählt                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| **Anbieter und Land**    | Personendaten deutscher Beschäftigter. Ein Anbieter in der EU erspart die Diskussion über Drittländer.                   |
| **Auftragsverarbeitung** | Mit dem Hoster nötig, bevor die ersten echten Daten dort liegen – nicht danach.                                          |
| **Adresse**              | Eigene Domain je Haus (`intranet.autohaus-x.de`) oder Kennung bei der Anmeldung. Beides geht.                            |
| **Bereitschaft**         | Wer schaut hin, wenn der Healthcheck rot wird? Auch „niemand vor acht Uhr" ist eine Antwort – sie gehört nur vereinbart. |
| **Zwei Umgebungen**      | Ohne Erprobungsumgebung testen Sie an zahlenden Häusern.                                                                 |

## Was der Betrieb danach kostet – an Zeit

Keine dieser Aufgaben ist groß. Zusammen sind sie ein halber Tag im Monat.

- **Sicherung an einen zweiten Ort.** Die Skripte sichern lokal; das schützt
  gegen Bedienfehler, nicht gegen den Ausfall der Maschine. Ein verschlüsselter
  Abzug auf einen anderen Speicher gehört dazu.
- **Probelauf der Wiederherstellung**, monatlich: `./scripts/probelauf.sh`.
- **Betriebssystem aktualisieren**, monatlich.
- **Healthcheck überwachen.** Ein Dienst, der `/api/health` im Minutentakt
  abfragt und bei `ok: false` meldet. Kostet wenige Euro.
- **Protokoll einsammeln.** Die Anwendung schreibt je Anfrage eine JSON-Zeile mit
  Haus, Route, Status und Dauer auf die Standardausgabe. Was sie einsammelt und
  durchsuchbar macht, entscheidet die Umgebung.

## Was mitgeliefert wird

- `docker-compose.yml` für Datenbank, API und Frontend.
- `scripts/sicherung.sh`, `scripts/wiederherstellung.sh`, `scripts/probelauf.sh`.
- Aufbewahrungs- und Anonymisierungslauf als eigene Prozesse für den Cron.
- Healthcheck unter `/api/health`, der Datenbankverbindung und Schlüssel prüft.

## Was fehlt

- Ein Reverse Proxy mit automatischem Zertifikat (Caddy oder Traefik) ist nicht
  Teil des Compose-Aufbaus. Er hängt davon ab, wo die Anwendung läuft, und ist in
  beiden Fällen eine knappe Konfigurationsdatei.
- Der Abzug der Sicherungen an einen zweiten Ort – aus demselben Grund.

Beides baue ich, sobald die Aufstellung feststeht. Vorher wäre es geraten.
