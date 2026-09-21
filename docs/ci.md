# AHOI – Erscheinungsbild

**AHOI** steht für **A**uto**h**aus **O**rganisation & **I**nformation.

Ein Regelwerk, keine Dekoration: Folien, Anmeldeseite und Anwendung greifen auf
dieselben Farben, dieselbe Schrift und dasselbe Zeichen zu. Wer hier etwas
ändert, ändert es überall.

## Haltung

Schlank. Viel Weißraum, eine kräftige Farbe, sonst Grau. Der Akzent markiert,
was zählt – er füllt keine Flächen. Kein maritimes Beiwerk: der Name ist eine
Abkürzung, kein Bild.

## Farben

Kühle Grautöne als Grundlage, ein warmer Signalton als Akzent. Der Kontrast
zwischen beiden trägt das ganze Erscheinungsbild.

| Rolle            | Hell      | Dunkel    | Wofür                                   |
| ---------------- | --------- | --------- | --------------------------------------- |
| Grund            | `#F1F3F5` | `#0E1113` | Seitenhintergrund                       |
| Fläche           | `#FFFFFF` | `#181C1F` | Karten, Tabellen, Folienelemente        |
| Schrift          | `#0F1417` | `#E6EAEC` | Überschriften, Fließtext                |
| Schrift gedämpft | `#4C575E` | `#A3AFB5` | Beschreibungen                          |
| Schrift leise    | `#78848B` | `#7B878E` | Beschriftungen, Achsen                  |
| Linie            | `#D3D9DD` | `#2A3338` | Rahmen, Trenner                         |
| **Akzent**       | `#DC3A14` | `#FF6B41` | Zeichen, aktive Zustände, Schaltflächen |
| Akzent Text      | `#A2270C` | `#FF8A66` | Akzentfarbene Schrift auf ruhigem Grund |
| Akzent zart      | `#FBE3D9` | `#3A1A0F` | Hinterlegungen, Markierungen            |

**Regel:** Der Akzent gehört der Marke. Zustände bekommen eigene Farben – Grün
für erledigt, Bernstein für wartend, Rosé für abgelehnt – und **immer** ein Wort
dazu, nie Farbe allein. Wo eine Zustandsfarbe neben dem Akzent steht, entscheidet
die Beschriftung, nicht der Farbton.

## Schrift

| Rolle        | Schrift           | Schnitt   | Einsatz                                  |
| ------------ | ----------------- | --------- | ---------------------------------------- |
| Auszeichnung | **Archivo**       | 600–800   | Überschriften, Zahlen, Wortmarke, Labels |
| Lesetext     | **Source Sans 3** | 400 / 600 | Fließtext, Formulare, Tabelleninhalt     |

Archivo eng laufen lassen (`-0.02em`) und groß setzen; Source Sans 3 bei 1,55
Zeilenhöhe. Beschriftungen in Versalien mit `0.14em` Sperrung, gesetzt und leise
– aber nicht kleiner als die Stufe `text-xs`: Versalien plus Sperrung kosten
Lesbarkeit, das darf die Größe nicht noch einmal kosten.

Die Stufen stehen in `tailwind.config.ts` und weichen bewusst von den
Tailwind-Vorgaben ab. `text-sm` ist mit rund zweihundert Fundstellen die
Brotschrift der Anwendung und liegt deshalb bei **16 px**, nicht bei 14; keine
Stufe geht unter **14 px**. Alle Stufen stehen in `rem` – sie hängen damit an
der Schriftgröße von `<html>` und wachsen mit der gewählten Darstellung mit.

## Darstellung: ein Design, zwei Voreinstellungen

Die Belegschaft eines Autohauses ist von der Auszubildenden bis zum
Servicemeister kurz vor der Rente alles auf einmal. Deshalb ist die Darstellung
einstellbar – aber es gibt **ein** Erscheinungsbild, nicht zwei Anwendungen. Ein
zweites, eigenes Design müsste bei jedem neuen Modul doppelt gepflegt werden und
wäre nach einem halben Jahr das schlechtere von beiden.

Verschoben werden vier Achsen, alles andere bleibt gleich:

| Achse        | Standard   | Groß & klar        | Wo sie sitzt                        |
| ------------ | ---------- | ------------------ | ----------------------------------- |
| Schriftgröße | 100 %      | 112,5 %            | `font-size` auf `<html>`            |
| Zeilenluft   | 1,55       | 1,75               | `--ahoi-zeilenluft`                 |
| Zielgröße    | 2,75 rem   | 3,25 rem           | `--ahoi-zielgroesse`, Klasse `ziel` |
| Kontrast     | Grundskala | eine Stufe dunkler | `--ahoi-slate-*`, `--ahoi-brand-*`  |

Weil die Farbskalen als RGB-Tripel in Variablen stehen und Tailwind sie über
`rgb(var(--…) / <alpha-value>)` einbindet, gilt der Wechsel für alle Seiten
zugleich – keine Utility-Klasse in den rund achtzig Seiten wird dafür angefasst.
In „Groß & klar" rückt die Grauskala eine Stufe nach unten: `text-slate-500`
kommt damit auf Weiß von 4,8:1 auf 7,4:1 und erfüllt WCAG 1.4.6 (AAA), ohne dass
die Oberfläche in Schwarz kippt.

Die Wahl steht **am Konto**, nicht im Browser: wer sie am Tresenrechner trifft,
findet sie auf dem Telefon in der Halle wieder. Gesetzt wird sie serverseitig als
`data-darstellung` auf `<html>` (`apps/web/app/layout.tsx`); ein Skript im
Browser würde bei jedem Aufruf kurz die kleine Schrift aufblitzen lassen.

**Was immer gilt, unabhängig von der Wahl:**

- Bedienflächen halten die Mindestgröße nach WCAG 2.2 (2.5.5) ein – Knöpfe,
  Eingabefelder und Auswahlen tragen dafür die Klasse `ziel` oder `min-h-ziel`.
  Ausgenommen sind Verweise im Textfluss, deren Höhe die Zeile bestimmt.
- Tastaturbedienung ist sichtbar: `:focus-visible` bekommt einen eigenen Rahmen
  im Akzent, weil der Standardrahmen unter den Rundungen fast verschwindet.
- Wer im Betriebssystem Bewegung abgestellt hat, bekommt keine Übergänge
  (`prefers-reduced-motion`).
- Zustände tragen immer ein Wort, nie nur einen Farbton.

**Grenze, ehrlich benannt:** Vor der Anmeldung weiß die Anwendung nicht, wer da
sitzt – Anmeldeseite und Passwortformulare erscheinen deshalb immer im Standard.
Das ist vertretbar, weil der Grundstand für alle angehoben wurde (16 px
Fließtext, 44 px Bedienflächen) und nicht erst die Voreinstellung ihn rettet.

Eine neue Voreinstellung entsteht in `packages/shared/src/types.ts`
(`DARSTELLUNG_DEFINITIONS`) **und** als Block `:root[data-darstellung="…"]` in
`globals.css`. Ein Test hält beides zusammen: ohne Block sähe die neue
Voreinstellung aus wie der Standard, ließe sich aber speichern – eine Wahl, die
nichts bewirkt.

## Zeichen

Das Signet ist ein Raster aus vier Feldern: **drei gefüllt, eines offen** – die
Module, die ein Haus einschaltet, und das eine, das es nicht braucht. Genau das
ist das Versprechen der Software, als Zeichen.

```
■ ■        Volltonfeld: Grundton (Schrift)
■ □        Eckfeld oben rechts: Akzent
```

- **Signet allein** ab 16 px, für Lesezeichen und kleine Flächen.
- **Wort-Bild-Marke** = Signet + `AHOI` in Archivo 800, Sperrung `0.08em`.
- Mindestabstand ringsum: die Breite eines Rasterfeldes.
- Nie verzerren, nie einfärben außer in den beiden Markenfarben, nie mit Verlauf
  oder Schatten hinterlegen.

Dateien: `apps/web/public/ahoi-signet.svg` (ohne Schriftabhängigkeit),
Komponente `apps/web/components/logo.tsx`.

## Wortwahl

- **AHOI** immer in Versalien, ohne Punkte.
- Anrede: Sie. Kurze Sätze. Aktiv.
- Schaltflächen sagen, was passiert: „Freigeben", danach „Freigegeben".
- Fehlermeldungen nennen Ursache und Ausweg, ohne Entschuldigung.
- Keine Abkürzungen aus der Technik in der Oberfläche.

## Wo das CI lebt

| Ort                               | Was dort steht                              |
| --------------------------------- | ------------------------------------------- |
| `apps/web/app/globals.css`        | Farbskalen und Achsen als Variablen         |
| `apps/web/tailwind.config.ts`     | Anbindung der Variablen, Schriftstufen      |
| `apps/web/app/layout.tsx`         | Setzt die gewählte Darstellung auf `<html>` |
| `apps/web/components/logo.tsx`    | Wort-Bild-Marke und Signet                  |
| `apps/web/public/ahoi-signet.svg` | Signet für alles außerhalb der App          |

Die Präsentation übernimmt dieselben Werte. Ändert sich eine Farbe, ändert sie
sich in beiden – dafür steht diese Seite.
