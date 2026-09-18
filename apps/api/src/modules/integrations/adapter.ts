import type { ConnectorDefinition } from "@ah-intranet/shared";

/** Aufgelöste Konfiguration eines Konnektors: Klartext, nur zur Laufzeit. */
export interface ConnectorContext {
  definition: ConnectorDefinition;
  /** Nicht-geheime Konfiguration. */
  settings: Record<string, string>;
  /** Entschlüsselte Geheimnisse. Verlassen den Prozess nicht. */
  secrets: Record<string, string>;
}

export interface CheckResult {
  ok: boolean;
  message: string;
}

export interface SyncResult {
  itemsProcessed: number;
  itemsFailed: number;
  message: string;
  detail?: Record<string, unknown>;
}

/**
 * Vertrag jedes Konnektors.
 *
 * Adapter für Systeme, deren Spezifikation nur mit Partnervertrag zu bekommen
 * ist, implementieren dieses Interface bewusst nicht - sie werden gar nicht
 * erst registriert. Die Registry kennzeichnet sie als `partner_contract`, und
 * der Runner weist Ausführungsversuche mit einer klaren Meldung ab. So ist an
 * jeder Stelle erkennbar, was echt läuft und was noch Vertragsarbeit braucht.
 */
export interface ConnectorAdapter {
  readonly key: string;

  /** Erreichbarkeit und Zugangsdaten prüfen, ohne Daten zu verändern. */
  check(context: ConnectorContext): Promise<CheckResult>;

  /** Eine Fähigkeit aus der Registry ausführen. */
  run(capability: string, context: ConnectorContext): Promise<SyncResult>;
}

/** Fehler, der dem Benutzer unverändert angezeigt werden darf. */
export class ConnectorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConnectorError";
  }
}

/** Pflichtfelder prüfen, bevor ein Adapter losläuft. */
export function requireFields(context: ConnectorContext, keys: string[]): void {
  const missing = keys.filter((key) => !context.settings[key]?.trim() && !context.secrets[key]?.trim());
  if (missing.length > 0) {
    const labels = missing.map((key) => context.definition.fields.find((field) => field.key === key)?.label ?? key);
    throw new ConnectorError(`Konfiguration unvollständig. Es fehlen: ${labels.join(", ")}.`);
  }
}

/** HTTP-Aufruf mit Zeitlimit; ohne das hängt ein Sync an einem stillen Endpunkt. */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs = 20_000, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...rest, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ConnectorError(`Zeitüberschreitung nach ${Math.round(timeoutMs / 1000)} Sekunden: ${url}`);
    }
    throw new ConnectorError(`Verbindung fehlgeschlagen: ${(error as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}
