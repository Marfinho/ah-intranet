import { AsyncLocalStorage } from "node:async_hooks";

export interface TenantContext {
  tenantId: string;
  slug: string;
}

/**
 * Der Mandant der laufenden Anfrage.
 *
 * Bewusst über AsyncLocalStorage und nicht als Parameter durch jede Signatur:
 * Ein vergessener Parameter fiele erst auf, wenn ein Autohaus die Daten eines
 * anderen sieht. Der Kontext wird einmal pro Anfrage gesetzt und von der
 * Prisma-Schicht automatisch auf jede Abfrage angewandt.
 */
const storage = new AsyncLocalStorage<TenantContext | typeof UNSCOPED>();

/** Markierung für Abläufe, die bewusst mandantenübergreifend arbeiten. */
const UNSCOPED = Symbol("unscoped");

/**
 * Führt einen Abschnitt im Kontext eines Mandanten aus.
 *
 * **Vorsicht bei Prisma-Aufrufen.** Ein Aufruf wie `prisma.x.findFirst()` gibt
 * ein *träges* Promise zurück: die Abfrage geht erst raus, wenn jemand sie
 * abwartet. Wird sie hier nur zurückgegeben, liegt das Abwarten außerhalb des
 * Kontexts - der ist dann schon wieder geschlossen, und die Mandantentrennung
 * weist die Abfrage ab.
 *
 * ```ts
 * // Falsch: das Abwarten passiert draußen.
 * await runWithTenant(ctx, () => prisma.order.findMany());
 *
 * // Richtig: das Abwarten liegt im Rumpf.
 * await runWithTenant(ctx, async () => {
 *   return await prisma.order.findMany();
 * });
 * ```
 *
 * Für einen Aufruf einer eigenen `async`-Methode gilt das nicht - deren Rumpf
 * läuft sofort los und nimmt den Kontext mit.
 */
export function runWithTenant<T>(context: TenantContext, callback: () => T): T {
  return storage.run(context, callback);
}

/**
 * Führt einen Abschnitt ohne Mandantenfilter aus.
 *
 * Nur für Abläufe, die es fachlich brauchen: Anmeldung (der Mandant steht erst
 * danach fest), Mandantenverwaltung durch die Plattformadministration und
 * Wartungsaufgaben. Jede Verwendung gehört begründet.
 *
 * Dieselbe Vorsicht bei trägen Prisma-Promises wie bei `runWithTenant`.
 */
export function runUnscoped<T>(callback: () => T): T {
  return storage.run(UNSCOPED, callback);
}

export function currentTenant(): TenantContext | null {
  const store = storage.getStore();
  return store && store !== UNSCOPED ? store : null;
}

export function isUnscoped(): boolean {
  return storage.getStore() === UNSCOPED;
}

/** True, wenn weder ein Mandant gesetzt noch ausdrücklich freigegeben wurde. */
export function hasNoContext(): boolean {
  return storage.getStore() === undefined;
}

/**
 * Der Mandant der laufenden Anfrage, oder ein Fehler.
 *
 * Nötig an den wenigen Stellen, an denen Prisma einen zusammengesetzten
 * Schlüssel verlangt und der Mandant deshalb ausdrücklich benannt werden muss
 * (`upsert` auf `@@unique([tenantId, ...])`). Überall sonst erledigt das die
 * Middleware in `PrismaService`.
 */
export function requireTenantId(): string {
  const context = currentTenant();
  if (!context) {
    throw new Error("Kein Mandantenkontext gesetzt.");
  }
  return context.tenantId;
}
