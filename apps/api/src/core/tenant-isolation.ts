import { Prisma } from "@prisma/client";

/** Modelle ohne Mandantenbezug: die Mandantentabelle selbst. */
const GLOBAL_MODELS = new Set<string>(["Tenant"]);

/** Aktionen, bei denen der Mandant in `where` gehört. */
const FILTERED_ACTIONS = new Set<Prisma.PrismaAction>([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "findUnique",
  "findUniqueOrThrow",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
  "count",
  "aggregate",
  "groupBy",
]);

/** Aktionen, bei denen der Mandant in die zu schreibenden Daten gehört. */
const WRITE_ACTIONS = new Set<Prisma.PrismaAction>(["create", "createMany", "upsert"]);

/** Schlüssel, unter denen Prisma verschachtelte Neuanlagen erwartet. */
const NESTED_CREATE_KEYS = ["create", "connectOrCreate", "upsert"] as const;

/**
 * Beziehungsinformationen je Modell, einmalig aus dem Datenmodell abgeleitet.
 *
 * `ownedRelations` sind Beziehungen, deren Fremdschlüssel auf diesem Modell
 * liegt (`author` zu `authorId`). Genau diese Felder gibt es nur in Prismas
 * geprüfter Schreibweise - taucht eines davon auf, sind Skalar-Fremdschlüssel
 * im selben Datensatz verboten. Beziehungen zur Gegenseite (`roles: { create }`)
 * sind in beiden Schreibweisen erlaubt und taugen deshalb nicht als Merkmal.
 */
interface ModelMeta {
  ownedRelations: Set<string>;
  relationTarget: Map<string, string>;
}

const META = new Map<string, ModelMeta>();

function meta(model: string): ModelMeta {
  let hit = META.get(model);
  if (hit) {
    return hit;
  }

  hit = { ownedRelations: new Set(), relationTarget: new Map() };
  const definition = Prisma.dmmf.datamodel.models.find((entry) => entry.name === model);
  for (const field of definition?.fields ?? []) {
    if (field.kind !== "object") {
      continue;
    }
    hit.relationTarget.set(field.name, field.type);
    if ((field.relationFromFields?.length ?? 0) > 0 && field.name !== "tenant") {
      hit.ownedRelations.add(field.name);
    }
  }

  META.set(model, hit);
  return hit;
}

/**
 * Setzt den Mandanten auf einen Anlage-Datensatz und steigt in verschachtelte
 * Anlagen ab.
 *
 * Bewusst überschreiben statt nur ergänzen: innerhalb eines Vorgangs gibt es
 * genau einen richtigen Mandanten. Ein vom Fachcode mitgegebener Wert darf nie
 * dazu führen, dass ein Datensatz in einem fremden Haus landet.
 *
 * Der Abstieg folgt nur den Schlüsseln, unter denen Prisma neue Datensätze
 * erwartet - `connect` bezieht sich auf bestehende und wird nicht angefasst.
 */
export function stampTenant(model: string, data: unknown, tenantId: string): unknown {
  if (Array.isArray(data)) {
    return data.map((entry) => stampTenant(model, entry, tenantId));
  }
  if (!data || typeof data !== "object") {
    return data;
  }

  const info = meta(model);
  const record = { ...(data as Record<string, unknown>) };

  if (record.tenant === undefined && record.tenantId === undefined) {
    // Der Datensatz gibt die Schreibweise vor; der Mandant muss ihr folgen.
    if (Object.keys(record).some((key) => info.ownedRelations.has(key))) {
      record.tenant = { connect: { id: tenantId } };
    } else {
      record.tenantId = tenantId;
    }
  } else if (record.tenantId !== undefined) {
    record.tenantId = tenantId;
  }

  for (const [key, value] of Object.entries(record)) {
    const target = info.relationTarget.get(key);
    if (!target || key === "tenant" || !value || typeof value !== "object") {
      continue;
    }

    const relation = value as Record<string, unknown>;
    const updated = { ...relation };
    let touched = false;

    for (const nestedKey of NESTED_CREATE_KEYS) {
      if (relation[nestedKey] !== undefined) {
        updated[nestedKey] = stampTenant(target, relation[nestedKey], tenantId);
        touched = true;
      }
    }

    if (relation.createMany !== undefined) {
      const createMany = relation.createMany as Record<string, unknown>;
      updated.createMany = { ...createMany, data: stampTenant(target, createMany.data, tenantId) };
      touched = true;
    }

    if (touched) {
      record[key] = updated;
    }
  }

  return record;
}

/** Ergänzt `where` um den Mandanten, ohne bestehende Bedingungen zu verlieren. */
export function filterByTenant(args: Record<string, unknown> | undefined, tenantId: string) {
  const next = { ...(args ?? {}) };
  next.where = { ...((next.where ?? {}) as Record<string, unknown>), tenantId };
  return next;
}

/**
 * Wendet die Mandantentrennung auf die Argumente einer Prisma-Operation an.
 *
 * Gemeinsam genutzt von der Laufzeit (Mandant aus dem Anfragekontext) und vom
 * Seed (fester Mandant) - beide müssen sich exakt gleich verhalten, sonst
 * erzeugt der Seed Daten, die die Anwendung später nicht findet.
 */
export function applyTenantScope(
  params: { model?: string; action: Prisma.PrismaAction; args?: Record<string, unknown> },
  tenantId: string,
): Record<string, unknown> | undefined {
  if (!params.model || GLOBAL_MODELS.has(params.model)) {
    return params.args;
  }

  let args = params.args;

  if (FILTERED_ACTIONS.has(params.action)) {
    args = filterByTenant(args, tenantId);
  }

  if (WRITE_ACTIONS.has(params.action)) {
    const next = { ...(args ?? {}) };

    if (params.action === "upsert") {
      next.where = { ...((next.where ?? {}) as Record<string, unknown>), tenantId };
      next.create = stampTenant(params.model, next.create, tenantId);
    } else {
      next.data = stampTenant(params.model, next.data, tenantId);
    }

    args = next;
  }

  return args;
}

export function isGlobalModel(model: string | undefined): boolean {
  return !model || GLOBAL_MODELS.has(model);
}
