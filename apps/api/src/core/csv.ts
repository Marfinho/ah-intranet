/**
 * CSV-Werkzeuge für Importe aus Fremdsystemen.
 *
 * Bewusst ohne Bibliothek: die Exporte deutscher Autohaus-Systeme sind
 * eigenwillig (Semikolon, latin1, Dezimalkomma, drei Datumsformate), und eine
 * generische Bibliothek müsste ohnehin an allen Stellen konfiguriert werden.
 * Als reine Funktionen lässt sich das Verhalten hier vollständig prüfen.
 */

/** Zerlegt eine Zeile und beachtet dabei Anführungszeichen und verdoppelte Anführungszeichen. */
export function splitCsvLine(line: string, delimiter = ";"): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let position = 0; position < line.length; position += 1) {
    const character = line[position];

    if (quoted) {
      if (character === '"') {
        if (line[position + 1] === '"') {
          current += '"';
          position += 1;
        } else {
          quoted = false;
        }
      } else {
        current += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === delimiter) {
      cells.push(current);
      current = "";
    } else {
      current += character;
    }
  }

  cells.push(current);
  return cells;
}

/**
 * Normalisiert eine Spaltenüberschrift für den Abgleich mit Synonymen:
 * Kleinschreibung, Umlaute ausgeschrieben, alles Übrige zu Unterstrichen.
 */
export function normaliseHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/"/g, "")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/(^_|_$)/g, "");
}

/** Liest eine Zahl in deutscher Schreibweise (`12.345,67`). */
export function parseGermanNumber(value: string | undefined): number | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  const parsed = Number(
    value
      .replace(/\./g, "")
      .replace(",", ".")
      .replace(/[^0-9.-]/g, ""),
  );
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseGermanInteger(value: string | undefined): number | undefined {
  const parsed = parseGermanNumber(value);
  return parsed === undefined ? undefined : Math.round(parsed);
}

/** Akzeptiert `TT.MM.JJJJ`, `JJJJ-MM[-TT]` und `MM/JJJJ`. */
export function parseFlexibleDate(value: string | undefined): Date | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  const trimmed = value.trim();

  const german = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(trimmed);
  if (german) {
    return utc(Number(german[3]), Number(german[2]), Number(german[1]));
  }

  const iso = /^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/.exec(trimmed);
  if (iso) {
    return utc(Number(iso[1]), Number(iso[2]), Number(iso[3] ?? 1));
  }

  const monthYear = /^(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (monthYear) {
    return utc(Number(monthYear[2]), Number(monthYear[1]), 1);
  }

  return undefined;
}

/** Verwirft unmögliche Datumsangaben, statt sie stillschweigend zu verschieben. */
function utc(year: number, month: number, day: number): Date | undefined {
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2200) {
    return undefined;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : undefined;
}

/** Zeichen U+FEFF als Konstante: als Literal im Quelltext wäre es unsichtbar. */
const BYTE_ORDER_MARK = "﻿";

/** Entfernt ein führendes Byte-Order-Mark, das sonst die erste Spalte verschiebt. */
export function stripBom(value: string): string {
  return value.startsWith(BYTE_ORDER_MARK) ? value.slice(BYTE_ORDER_MARK.length) : value;
}
