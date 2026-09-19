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
Zeilenhöhe. Beschriftungen in Versalien mit `0.14em` Sperrung, klein und leise.

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

| Ort                               | Was dort steht                     |
| --------------------------------- | ---------------------------------- |
| `apps/web/app/globals.css`        | Farbtoken als CSS-Variablen        |
| `apps/web/tailwind.config.ts`     | Akzentskala, Schriftfamilien       |
| `apps/web/components/logo.tsx`    | Wort-Bild-Marke und Signet         |
| `apps/web/public/ahoi-signet.svg` | Signet für alles außerhalb der App |

Die Präsentation übernimmt dieselben Werte. Ändert sich eine Farbe, ändert sie
sich in beiden – dafür steht diese Seite.
