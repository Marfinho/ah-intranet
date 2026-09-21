/**
 * Reine Regel: welche Schwellen sind bei dieser Messung überschritten?
 *
 * Getrennt vom `SystemMonitorService`, weil sich das Ergebnis vollständig aus
 * den Eingaben ergibt - zwischen Datenbankabfragen und E-Mail-Versand
 * versteckt wäre diese Regel nur mit laufendem Server prüfbar.
 */
export interface Messung {
  cpuPercent: number;
  memPercent: number;
  diskPercent: number;
}

export interface Schwellen {
  cpuThresholdPercent: number;
  memThresholdPercent: number;
  diskThresholdPercent: number;
}

export function schwellenUeberschreitungen(messung: Messung, schwellen: Schwellen): string[] {
  const ueberschritten: string[] = [];

  if (messung.cpuPercent >= schwellen.cpuThresholdPercent) {
    ueberschritten.push(`CPU-Last ${messung.cpuPercent.toFixed(0)} % (Schwelle ${schwellen.cpuThresholdPercent} %)`);
  }
  if (messung.memPercent >= schwellen.memThresholdPercent) {
    ueberschritten.push(
      `Arbeitsspeicher ${messung.memPercent.toFixed(0)} % (Schwelle ${schwellen.memThresholdPercent} %)`,
    );
  }
  if (messung.diskPercent >= schwellen.diskThresholdPercent) {
    ueberschritten.push(
      `Plattenplatz ${messung.diskPercent.toFixed(0)} % (Schwelle ${schwellen.diskThresholdPercent} %)`,
    );
  }

  return ueberschritten;
}

/** Mindestabstand zur letzten Warnung eingehalten? */
export function abstandEingehalten(lastAlertAt: Date | null, cooldownMinutes: number, now: Date): boolean {
  if (!lastAlertAt) {
    return true;
  }
  return now.getTime() - lastAlertAt.getTime() >= cooldownMinutes * 60 * 1000;
}
