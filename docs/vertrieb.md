# Vertrieb: Interessenten, Pitch-Seite, Preisliste

Wie aus einem Interessenten eine Pitch-Seite mit Preisrechner wird. Nur für die
Verwaltung des Betreibers (`apps/verwaltung`, siehe [`verwaltung.md`](verwaltung.md)), nicht für ein Haus. **Interessenten anlegen und Haus anlegen geschehen dort**; in der Kunden-Anwendung lebt nur die öffentliche Pitch-Seite.

## Ablauf

1. **Interessent anlegen** unter _Verwaltung → Interessenten → Neuer Interessent_. Dazu die
   Häuser als Textzeilen: `Name | Straße | PLZ Ort | Marken | Leistungen |
Öffnungszeiten | Verbund | eigener Text`. Häuser mit gleichem **Verbund** (z. B.
   dieselbe Straße) schlagen gemeinsame Raumbuchung und Kalender vor.
2. **Link** erscheint einmalig nach dem Anlegen. Gespeichert ist nur ein Hash. Geht
   er verloren: neuen Link erzeugen, der alte gilt sofort nicht mehr. Widerruf
   und Ablauf (60 Tage, höchstens 365) antworten von außen gleich wie ein
   Link, den es nie gab.
3. **Pitch-Seite** (`/angebot/<token>`) ohne Anmeldung: Häuser, Funktionsübersicht,
   Preisrechner und eine Schlussseite („Ihr Alltag“): zu den ersten sechs Fragen der
   Eröffnungsseite läuft je eine kurze Ablaufanimation, dazu steht, ob die dafür
   nötigen Module in der gewählten Auswahl stecken. Der Interessent stellt Häuser, Nutzer,
   Key-User, Paket oder Einzelmodule ein. Die Seite beginnt mit einer Animation,
   die zeigt, wie der Name AHOI entsteht, und lässt sich überspringen.
   **Die Häuser kann er verändern**: umbenennen, Werkstatt, Teiledienst und
   Sonntagsöffnung ein- und ausschalten, Marken ergänzen, einen gemeinsamen
   Standort setzen, Häuser hinzufügen oder entfernen. Der Vorschlag je Haus rechnet
   sofort mit (dieselben Regeln wie auf dem Server, aus `pitch-vorschlag.ts`), und
   die Änderungen fließen in das Angebot (Zahl der Häuser, Einrichtung), in die
   Funktionsübersicht. Alles wird gespeichert; "Zurücksetzen"
   führt auf die Angaben des Betreibers zurück.
4. **Anfrage** setzt den Status auf _angefragt_, hält das vom Server gerechnete
   Angebot samt Version der Preisliste fest und benachrichtigt alle Konten der
   Plattformverwaltung (auch per Mail, wenn SMTP eingerichtet ist).
5. **Haus anlegen** auf der Seite des Interessenten. Hat der Interessent seine
   Häuser verändert, gelten seine: das Angebot ist auf ihnen gerechnet, und die
   Vorschau sagt, woher die Häuser stammen. Wer die eigenen Angaben neu festlegt
   (Stammdaten und Häuser speichern), verwirft die Änderungen des Interessenten.
   Die Vorschau zeigt, was
   entsteht; nur Kennung und erstes Administrationskonto kommen von Hand.
   Übernommen werden: Standorte (Kürzel aus den Namen, eindeutig je Haus),
   Marken, Abteilungen aus den Leistungen (Verkauf `VKF`, Service `SRV`,
   Teiledienst `TLD`, Disposition `DSP`, sonst abgeleitet), Zuordnung von Marken
   und Abteilungen zu Standorten, Lizenzkontingent = Nutzerzahl der Auswahl und
   der Modulzustand. Das Standortlimit bleibt unbegrenzt, weil Häuser nur
   Einrichtung kosten. Erprobungen bleiben aus, auch im Tier Komplett. Es
   geschieht in einer Transaktion wie bei jedem Haus; ein Interessent wird
   höchstens einmal zum Haus und danach auf _gewonnen_ gesetzt.

Die Adresse der Pitch-Seite gehört zum Plattform-Mandanten (`verwaltung.<domain>`).
Unter der Adresse eines Kundenhauses findet sie keinen Interessenten.

## Preisliste

Einzige Quelle: `packages/shared/src/preise.ts`. Alle Beträge in ganzen Cent, netto.

| Tier     | Basis/Monat | je Nutzer | Module                                        |
| -------- | ----------- | --------- | --------------------------------------------- |
| Basis    | 50 €        | 0,75 €    | 7 (Kernmodule, Aktuelles, Verzeichnis, …)     |
| Prozesse | 100 €       | 1,50 €    | 11 (dazu Bestellungen, Freigaben, Tickets, …) |
| Komplett | 150 €       | 3,00 €    | alle 22, Erprobungen nach Freischaltung       |

**Einzelmodul:** Basispreis 50 € plus je Modul 10 € und 0,25 € je Nutzer.
Kernmodule sind immer enthalten, Erprobungen (`beta`) nicht einzeln buchbar.

**Einmalig:** Einrichtung (Grundpaket + je weiteres Haus, nach Tier bzw. bei
Einzelwahl nach Umfang) und Schulung (1.000 € je Termin, 6 Personen; ohne Angabe
1,5 Key-User je Haus).

Ein Test hält fest, dass ein Tier für **jede** Nutzerzahl höchstens so viel
kostet wie dieselben Module einzeln. Wer Einzelpreise senkt, bricht ihn und merkt es.

Die Liste liegt im Code, nicht in der Datenbank: eine Preisänderung läuft durch
die Prüfpipeline. Jede Anfrage trägt `PREISLISTE_VERSION`, damit sich eine
gezeigte Zahl nicht still ändert. Bei Änderungen die Version hochzählen.

## Aufbewahrung und Datenschutz

Interessenten sind Unternehmensdaten plus höchstens der Name einer
Ansprechperson. Frist: 2 Jahre nach letzter Änderung, gewonnene bleiben
(`retention.ts`, Schlüssel `lead`). **Mit der Rechtsberatung abzugleichen.**

## Noch nicht gebaut

- PDF-Export des Angebots, elektronische Unterschrift.
- Bearbeitbare Preisliste in der Oberfläche.
