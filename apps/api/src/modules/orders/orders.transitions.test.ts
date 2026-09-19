import { describe, expect, it } from "vitest";
import type { OrderStatus } from "@prisma/client";
import { ALLOWED_TRANSITIONS, STATUS_LABELS } from "./orders.service";

/**
 * Der Freigabeprozess ist das fachliche Herzstück. Diese Prüfungen halten die
 * Übergangstabelle fest, damit eine spätere Erweiterung nicht versehentlich
 * einen Weg öffnet, der die Freigabe umgeht.
 */

const ALL: OrderStatus[] = [
  "draft",
  "submitted",
  "approved",
  "rejected",
  "queued_for_bulk_order",
  "ordered",
  "completed",
  "cancelled",
];

describe("ALLOWED_TRANSITIONS", () => {
  it("kennt jeden Status", () => {
    expect(Object.keys(ALLOWED_TRANSITIONS).sort()).toEqual([...ALL].sort());
  });

  it("führt den regulären Weg vom Entwurf bis zum Abschluss", () => {
    expect(ALLOWED_TRANSITIONS.draft).toContain("submitted");
    expect(ALLOWED_TRANSITIONS.submitted).toContain("approved");
    expect(ALLOWED_TRANSITIONS.approved).toContain("queued_for_bulk_order");
    expect(ALLOWED_TRANSITIONS.queued_for_bulk_order).toContain("ordered");
    expect(ALLOWED_TRANSITIONS.ordered).toContain("completed");
  });

  it("lässt die Freigabe nicht überspringen", () => {
    // Ohne Freigabe darf nichts bestellt oder abgeschlossen werden.
    expect(ALLOWED_TRANSITIONS.submitted).not.toContain("ordered");
    expect(ALLOWED_TRANSITIONS.submitted).not.toContain("completed");
    expect(ALLOWED_TRANSITIONS.draft).not.toContain("approved");
  });

  it("erlaubt Ablehnung nur aus der Einreichung heraus", () => {
    expect(ALLOWED_TRANSITIONS.submitted).toContain("rejected");

    const andere = ALL.filter((status) => status !== "submitted");
    for (const status of andere) {
      expect(ALLOWED_TRANSITIONS[status]).not.toContain("rejected");
    }
  });

  it("behandelt abgeschlossene, abgelehnte und stornierte Vorgänge als endgültig", () => {
    expect(ALLOWED_TRANSITIONS.completed).toEqual([]);
    expect(ALLOWED_TRANSITIONS.rejected).toEqual([]);
    expect(ALLOWED_TRANSITIONS.cancelled).toEqual([]);
  });

  it("lässt eine extern ausgelöste Bestellung nicht mehr stornieren", () => {
    // Beim Dienstleister ist sie dann bereits in Produktion.
    expect(ALLOWED_TRANSITIONS.ordered).not.toContain("cancelled");
  });

  it("erlaubt Stornierung in allen Stadien davor", () => {
    for (const status of ["draft", "submitted", "approved", "queued_for_bulk_order"] as OrderStatus[]) {
      expect(ALLOWED_TRANSITIONS[status]).toContain("cancelled");
    }
  });

  it("kennt keinen Übergang auf sich selbst", () => {
    for (const status of ALL) {
      expect(ALLOWED_TRANSITIONS[status]).not.toContain(status);
    }
  });

  it("verweist ausschließlich auf gültige Zielstatus", () => {
    for (const targets of Object.values(ALLOWED_TRANSITIONS)) {
      for (const target of targets) {
        expect(ALL).toContain(target);
      }
    }
  });

  it("macht jeden Status außer dem Entwurf erreichbar", () => {
    const erreichbar = new Set(Object.values(ALLOWED_TRANSITIONS).flat());

    for (const status of ALL.filter((entry) => entry !== "draft")) {
      expect(erreichbar).toContain(status);
    }
  });
});

describe("STATUS_LABELS", () => {
  it("beschriftet jeden Status auf Deutsch", () => {
    for (const status of ALL) {
      expect(STATUS_LABELS[status]).toBeTruthy();
      expect(STATUS_LABELS[status]).not.toBe(status);
    }
  });
});
