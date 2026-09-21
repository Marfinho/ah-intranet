import { Prisma } from "@prisma/client";

/**
 * Modelle ohne Mandantenbezug: die Mandantentabelle selbst sowie der Betrieb
 * der Maschine (Warnsystem-Einstellungen, Lastmesspunkte) - beides gilt für
 * die Installation als Ganzes, nicht für ein einzelnes Haus.
 */
const GLOBAL_MODELS = new Set<string>(["Tenant", "PlatformSettings", "SystemMetricSample"]);

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

/**
 * Aktionen, die einen bestehenden Datensatz ändern.
 *
 * Der Datensatz selbst trägt seinen Mandanten bereits - aber `data` darf
 * verschachtelte Neuanlagen enthalten (`statusHistory: { create: ... }`), und
 * die brauchen den Mandanten genauso wie eine eigenständige Anlage.
 */
const UPDATE_ACTIONS = new Set<Prisma.PrismaAction>(["update", "updateMany"]);

/** Wendet `fn` auf einen verschachtelten Eintrag an - einzeln wie als Liste. */
function mapEntries(value: unknown, fn: (entry: Record<string, unknown>) => Record<string, unknown>): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => fn(entry as Record<string, unknown>));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return fn(value as Record<string, unknown>);
}

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
 * Der Abstieg folgt nur den Schlüsseln, unter denen Prisma Datensätze anlegen
 * oder ändern kann - `connect` bezieht sich auf bestehende und wird nicht
 * angefasst. Mit `stampSelf === false` bleibt der Datensatz selbst unberührt;
 * das ist der Fall bei Änderungen, die ihren Mandanten schon tragen.
 */
export function stampTenant(model: string, data: unknown, tenantId: string, stampSelf = true): unknown {
  if (Array.isArray(data)) {
    return data.map((entry) => stampTenant(model, entry, tenantId, stampSelf));
  }
  if (!data || typeof data !== "object") {
    return data;
  }

  const info = meta(model);
  const record = { ...(data as Record<string, unknown>) };

  if (!stampSelf) {
    // Der Datensatz existiert schon; nur die verschachtelten Neuanlagen zählen.
  } else if (record.tenant === undefined && record.tenantId === undefined) {
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

    if (relation.create !== undefined) {
      updated.create = stampTenant(target, relation.create, tenantId);
      touched = true;
    }

    // `connectOrCreate` und `upsert` sind Hüllen mit `where`/`create`/`update` -
    // gestempelt wird der Datensatz darin, nicht die Hülle.
    for (const huelle of ["connectOrCreate", "upsert"] as const) {
      if (relation[huelle] === undefined) {
        continue;
      }
      updated[huelle] = mapEntries(relation[huelle], (entry) => ({
        ...entry,
        ...(entry.create !== undefined ? { create: stampTenant(target, entry.create, tenantId) } : {}),
        ...(entry.update !== undefined ? { update: stampTenant(target, entry.update, tenantId, false) } : {}),
      }));
      touched = true;
    }

    // Änderungen legen keinen Datensatz an, können aber welche enthalten.
    for (const aenderung of ["update", "updateMany"] as const) {
      if (relation[aenderung] === undefined) {
        continue;
      }
      updated[aenderung] = mapEntries(relation[aenderung], (entry) =>
        entry.data !== undefined
          ? { ...entry, data: stampTenant(target, entry.data, tenantId, false) }
          : (stampTenant(target, entry, tenantId, false) as Record<string, unknown>),
      );
      touched = true;
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
      if (next.update !== undefined) {
        next.update = stampTenant(params.model, next.update, tenantId, false);
      }
    } else {
      next.data = stampTenant(params.model, next.data, tenantId);
    }

    args = next;
  }

  if (UPDATE_ACTIONS.has(params.action) && args?.data !== undefined) {
    args = { ...args, data: stampTenant(params.model, args.data, tenantId, false) };
  }

  return args;
}

export function isGlobalModel(model: string | undefined): boolean {
  return !model || GLOBAL_MODELS.has(model);
}
