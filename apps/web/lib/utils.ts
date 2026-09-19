import clsx from "clsx";

export function cn(...values: Array<string | false | null | undefined>) {
  return clsx(values);
}

const dateFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });
const dateTimeFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" });
const timeFormatter = new Intl.DateTimeFormat("de-DE", { timeStyle: "short" });

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "–";
  return dateFormatter.format(new Date(value));
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "–";
  return dateTimeFormatter.format(new Date(value));
}

export function formatTime(value: string | Date | null | undefined): string {
  if (!value) return "–";
  return timeFormatter.format(new Date(value));
}

/** Zeitraum kompakt: gleicher Tag zeigt nur einmal das Datum. */
export function formatRange(start: string, end: string): string {
  const from = new Date(start);
  const to = new Date(end);
  if (from.toDateString() === to.toDateString()) {
    return `${dateFormatter.format(from)}, ${timeFormatter.format(from)} – ${timeFormatter.format(to)}`;
  }
  return `${dateTimeFormatter.format(from)} – ${dateTimeFormatter.format(to)}`;
}

/** Wert für `<input type="datetime-local">`. */
export function toLocalInput(value: Date): string {
  const offset = value.getTimezoneOffset();
  return new Date(value.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

export function toDateInput(value: Date): string {
  const offset = value.getTimezoneOffset();
  return new Date(value.getTime() - offset * 60_000).toISOString().slice(0, 10);
}
