import { Prisma } from "../generated/prisma/client";
import { applyTenantScope, isGlobalModel } from "./tenant-isolation";

/**
 * Was mit einer Abfrage geschehen soll: auf einen Mandanten festlegen oder
 * unverändert durchlassen.
 */
export type MandantenEntscheidung = { mandant: string } | "durchlassen";

/**
 * Hängt die Mandantentrennung an jede Abfrage auf einem Modell.
 *
 * Löst die frühere Middleware (`$use`) ab, die Prisma 7 nicht mehr kennt. Die
 * Filterlogik selbst (`applyTenantScope`) ist unverändert und wird von
 * Anwendung, Seed und Einrichtung gemeinsam genutzt - alle verhalten sich
 * dadurch exakt gleich.
 *
 * `entscheide` bekommt Modell und Operation und liefert die Entscheidung;
 * es darf werfen, um eine Abfrage ohne Mandantenkontext abzuweisen.
 *
 * Grenze wie bisher: Rohabfragen (`$queryRaw`, `$executeRaw`) haben kein Modell
 * und laufen ungefiltert. Die Erweiterung hängt sich bewusst nur an Modelle.
 */
export function mandantenTrennung(entscheide: (modell: string, operation: string) => MandantenEntscheidung) {
  return Prisma.defineExtension({
    name: "mandantentrennung",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (isGlobalModel(model)) {
            return query(args);
          }
          const entscheidung = entscheide(model, operation);
          if (entscheidung === "durchlassen") {
            return query(args);
          }
          const gefiltert = applyTenantScope(
            { model, action: operation as Prisma.PrismaAction, args: args as Record<string, unknown> },
            entscheidung.mandant,
          );
          return query(gefiltert as typeof args);
        },
      },
    },
  });
}
