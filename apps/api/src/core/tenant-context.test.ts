import { describe, expect, it } from "vitest";
import { isUnscoped, runUnscoped, runWithTenant, currentTenant } from "./tenant-context";

const HAUS = { tenantId: "t1", slug: "autohaus-mueller" };

/**
 * Ein träges Promise, wie Prisma es zurückgibt: die Arbeit beginnt erst, wenn
 * jemand `then` aufruft. Genau daran scheitert ein Kontext, der zu früh
 * geschlossen wird.
 */
function tragesPromise<T>(arbeit: () => T): PromiseLike<T> {
  return {
    then(onfulfilled) {
      return Promise.resolve(arbeit()).then(onfulfilled) as never;
    },
  };
}

describe("Mandantenkontext", () => {
  it("setzt den Mandanten im Rumpf", () => {
    runWithTenant(HAUS, () => {
      expect(currentTenant()).toEqual(HAUS);
      expect(isUnscoped()).toBe(false);
    });
    expect(currentTenant()).toBeNull();
  });

  it("markiert einen freigegebenen Abschnitt", () => {
    runUnscoped(() => {
      expect(isUnscoped()).toBe(true);
      expect(currentTenant()).toBeNull();
    });
  });

  it("verliert den Kontext, wenn ein träges Promise nur zurückgegeben wird", async () => {
    // Der Fallstrick in einer Zeile: die Abfrage startet erst beim `await`
    // draußen - da ist der Kontext zu. So gebaut, weist die Mandantentrennung
    // den Zugriff ab, und zwar erst zur Laufzeit.
    const gesehen = await runWithTenant(HAUS, () => tragesPromise(() => currentTenant()));
    expect(gesehen).toBeNull();
  });

  it("behält den Kontext, wenn im Rumpf abgewartet wird", async () => {
    const gesehen = await runWithTenant(HAUS, async () => {
      return await tragesPromise(() => currentTenant());
    });
    expect(gesehen).toEqual(HAUS);
  });

  it("gilt genauso für den freigegebenen Abschnitt", async () => {
    const draussen = await runUnscoped(() => tragesPromise(() => isUnscoped()));
    const drinnen = await runUnscoped(async () => {
      return await tragesPromise(() => isUnscoped());
    });
    expect(draussen).toBe(false);
    expect(drinnen).toBe(true);
  });
});
