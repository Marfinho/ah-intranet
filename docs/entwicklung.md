# Entwicklung und Freigabe

Wie eine Änderung von der Idee bis in ein Autohaus kommt. Kurz genug, dass sich
alle daran halten.

## Zweige

| Zweig            | Bedeutung                                                 |
| ---------------- | --------------------------------------------------------- |
| `main`           | Der freigegebene Stand. Was hier liegt, darf in ein Haus. |
| `feature/<kurz>` | Eine neue Funktion.                                       |
| `fix/<kurz>`     | Eine Fehlerbehebung.                                      |

**Auf `main` wird nicht direkt gearbeitet.** Jede Änderung läuft über einen Pull
Request. Das ist keine Förmlichkeit: die Prüfpipeline ist die einzige Stelle, an
der Migrationen gegen eine leere Datenbank laufen und die Wiederherstellung
geprobt wird. Wer daran vorbei nach `main` schiebt, umgeht genau die Prüfung, die
einen kaputten Stand beim Kunden verhindert.

Ein Zweig bleibt klein. Acht Commits in einem Rutsch wie beim ersten Stand sind
eine Ausnahme für den Anfang, nicht das Muster.

## Pull Request

1. Zweig anlegen, Änderung bauen, lokal prüfen:
   ```bash
   pnpm typecheck && pnpm lint && pnpm test && pnpm build
   ```
2. Pull Request nach `main` öffnen. Der Text nennt **warum**, nicht nur was.
3. Die Prüfpipeline muss grün sein. Rot heißt: nicht mergen, auch nicht „nur
   dieses eine Mal".
4. Nach dem Merge: Kennzeichen setzen (siehe unten).

## Versionsnummer

Sie steht in der `package.json` im Wurzelverzeichnis und wird beim Merge als
Git-Kennzeichen gesetzt: `v0.2.0`.

| Stelle | Hochzählen, wenn …                                                          |
| ------ | --------------------------------------------------------------------------- |
| erste  | ein Haus etwas anders bedienen muss als vorher, oder Daten umgezogen werden |
| zweite | eine Funktion dazukommt, ohne dass sich Bestehendes ändert                  |
| dritte | ein Fehler behoben wird                                                     |

Maßstab ist **das Haus, nicht der Code**. Eine große Umbauaktion, die niemand
bemerkt, ist die dritte Stelle. Ein verschobener Knopf, den zwanzig Leute neu
suchen müssen, ist die erste.

Jede Version bekommt einen Eintrag in [`CHANGELOG.md`](../CHANGELOG.md), und zwar
in der Sprache der Häuser – nicht „`ModuleRegistryService` refaktoriert", sondern
was sich für die Menschen ändert.

## Datenbankänderungen

- Migrationen laufen **nur vorwärts**. Eine bereits angewandte Migration wird nie
  geändert; ein Fehler darin wird durch eine neue Migration behoben.
- Vor jedem Einspielen eine Sicherung: `./scripts/sicherung.sh`. Das ist der
  Rückweg, und er kostet Sekunden.
- Nach jeder Schemaänderung einmal `./scripts/probelauf.sh` – er prüft, ob sich
  eine Sicherung noch vollständig zurückspielen lässt.
- Eine Migration, die Spalten oder Tabellen entfernt, gehört in einen eigenen
  Pull Request. Sie ist nicht rückgängig zu machen und verdient eigene Aufmerksamkeit.

## Freigabe an ein Haus

Kurzliste, die vor jedem Einspielen abgearbeitet wird:

1. `main` ist grün.
2. Änderungsprotokoll gepflegt, Version hochgezählt, Kennzeichen gesetzt.
3. Sicherung gezogen und ihre Prüfsumme geprüft.
4. Migrationen einspielen (`prisma migrate deploy` – **nie** `migrate dev` auf
   einem Server, das erzeugt neue Migrationen).
5. Dienste neu starten, Healthcheck aufrufen, eine Anmeldung je Haus prüfen.
6. Auffälligkeiten? Sicherung zurückspielen, nicht nachbessern.

Einzelheiten zum Betrieb: [`betrieb.md`](betrieb.md).

## Neue Funktionen erproben

Die Modulsteuerung schaltet **je Haus**. Eine neue Funktion wird deshalb als
Modul mit dem Reifegrad `beta` ausgeliefert:

```ts
{ key: "schichtplan", label: "Schichtplan", ..., defaultEnabled: false, stage: "beta" }
```

Damit gilt automatisch:

- Das Modul ist aus. `defaultEnabled: false` gehört dazu – alles andere wäre
  ein Widerspruch.
- **Einschalten darf nur die Plattformverwaltung.** Versucht es ein Admin im
  Haus, weist die API ihn mit Begründung ab. Abschalten darf er jederzeit, sonst
  säße das Haus in einer Funktion fest, die es nicht mehr will.
- Das Modul trägt in Navigation und Modulsteuerung ein sichtbares **Beta**.
  Niemand soll unbemerkt in einer Erprobung arbeiten.

Ein Pilothaus bekommt die Funktion, die anderen merken nichts davon. Ist sie
erprobt, wird aus `beta` ein `stabil` und aus `defaultEnabled: false` je nach
Funktion ein `true` – ein Zweizeiler in der Registry, keine Migration.

Für Änderungen **innerhalb** eines bestehenden Moduls reicht das nicht. Einen
feineren Schalter gibt es bewusst noch nicht; er entsteht, wenn der erste Fall
da ist.

Zwei Dinge, die dabei ehrlich benannt gehören:

- **Gemeinsame Installation heißt gemeinsames Risiko.** Ein Modulschalter trennt
  Funktionen, eine fehlerhafte Migration trifft trotzdem alle Häuser. Deshalb
  Punkt 3 der Freigabeliste.
- **Testdaten aus der Produktion gehören anonymisiert.** Echte Personendaten in
  einer Erprobungsumgebung sind ein Datenschutzverstoß, kein Schönheitsfehler.
  Die Anonymisierung gibt es bereits je Person; für eine ganze Datenbank fehlt
  der Massenlauf.

## Was noch fehlt

- Eine laufende Installation. Ohne sie bleibt alles oberhalb Theorie.
- Fehler- und Protokollauswertung. Ohne sie fällt ein Fehler erst auf, wenn
  jemand anruft.
