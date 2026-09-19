import { describe, expect, it } from "vitest";
import {
  CONNECTOR_DEFINITIONS,
  CORE_MODULE_KEYS,
  MODULE_DEFINITIONS,
  MODULE_GROUP_LABELS,
  MODULE_STAGES,
  betaModules,
  getConnector,
  getDependentModules,
  getModule,
  isBeta,
  isConnectorKey,
  isModuleKey,
  isRunnable,
} from "./index";

/**
 * Die Registries sind die einzige Quelle der Wahrheit für Module und
 * Konnektoren. Ein Tippfehler dort wirkt sich auf Navigation, Guards und
 * Adminoberfläche gleichzeitig aus - diese Prüfungen fangen das früh ab.
 */

describe("Modulregistry", () => {
  it("vergibt jeden Schlüssel nur einmal", () => {
    const keys = MODULE_DEFINITIONS.map((module) => module.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("vergibt jede Route nur einmal", () => {
    const routes = MODULE_DEFINITIONS.map((module) => module.href);
    expect(new Set(routes).size).toBe(routes.length);
  });

  it("ordnet jedes Modul einer bekannten Gruppe zu", () => {
    for (const module of MODULE_DEFINITIONS) {
      expect(Object.keys(MODULE_GROUP_LABELS)).toContain(module.group);
    }
  });

  it("verweist nur auf existierende Abhängigkeiten", () => {
    for (const module of MODULE_DEFINITIONS) {
      for (const dependency of module.dependsOn) {
        expect(isModuleKey(dependency)).toBe(true);
      }
    }
  });

  it("kennt keine zirkulären Abhängigkeiten", () => {
    for (const module of MODULE_DEFINITIONS) {
      const besucht = new Set<string>();
      const offen: string[] = [...module.dependsOn];

      while (offen.length > 0) {
        const current = offen.shift()!;
        expect(current).not.toBe(module.key);

        if (!besucht.has(current)) {
          besucht.add(current);
          offen.push(...(getModule(current)?.dependsOn ?? []));
        }
      }
    }
  });

  it("hält Kernmodule frei von Abhängigkeiten", () => {
    // Ein Kernmodul darf nie über eine Abhängigkeit abschaltbar werden.
    for (const key of CORE_MODULE_KEYS) {
      expect(getModule(key)?.dependsOn).toEqual([]);
    }
  });

  it("aktiviert Kernmodule standardmäßig", () => {
    for (const key of CORE_MODULE_KEYS) {
      expect(getModule(key)?.defaultEnabled).toBe(true);
    }
  });

  it("findet abhängige Module in beide Richtungen konsistent", () => {
    for (const module of MODULE_DEFINITIONS) {
      for (const dependent of getDependentModules(module.key)) {
        expect(dependent.dependsOn).toContain(module.key);
      }
    }
  });

  it("weist unbekannte Schlüssel ab", () => {
    expect(isModuleKey("gibtesnicht")).toBe(false);
    expect(getModule("gibtesnicht")).toBeUndefined();
  });

  it("beginnt jede Route mit einem Schrägstrich", () => {
    for (const module of MODULE_DEFINITIONS) {
      expect(module.href.startsWith("/")).toBe(true);
    }
  });
});

describe("Konnektorregistry", () => {
  it("vergibt jeden Schlüssel nur einmal", () => {
    const keys = CONNECTOR_DEFINITIONS.map((connector) => connector.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("vergibt Fähigkeitsschlüssel je Konnektor nur einmal", () => {
    for (const connector of CONNECTOR_DEFINITIONS) {
      const keys = connector.capabilities.map((capability) => capability.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("vergibt Feldschlüssel je Konnektor nur einmal", () => {
    for (const connector of CONNECTOR_DEFINITIONS) {
      const keys = connector.fields.map((field) => field.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("speichert Passwortfelder ausnahmslos als Geheimnis", () => {
    for (const connector of CONNECTOR_DEFINITIONS) {
      for (const field of connector.fields) {
        if (field.type === "password") {
          expect(field.secret).toBe(true);
        }
      }
    }
  });

  it("markiert nur dort Fähigkeiten als umgesetzt, wo die Spezifikation offen ist", () => {
    // Kern der Ehrlichkeitszusage: ohne offene Spezifikation kein lauffähiger Adapter.
    for (const connector of CONNECTOR_DEFINITIONS) {
      if (connector.availability === "partner_contract") {
        expect(isRunnable(connector)).toBe(false);
      }
    }
  });

  it("nennt für vertraglich geschützte Systeme den Weg zur Inbetriebnahme", () => {
    for (const connector of CONNECTOR_DEFINITIONS) {
      if (connector.availability === "partner_contract") {
        expect(connector.onboarding.length).toBeGreaterThan(0);
      }
    }
  });

  it("gibt Portalkonnektoren keine Datenvorgänge", () => {
    for (const connector of CONNECTOR_DEFINITIONS) {
      if (connector.availability === "portal_link") {
        expect(connector.capabilities).toEqual([]);
        expect(connector.direction).toBe("none");
      }
    }
  });

  it("hat für jeden umgesetzten Konnektor mindestens ein Pflichtfeld", () => {
    for (const connector of CONNECTOR_DEFINITIONS) {
      if (isRunnable(connector)) {
        expect(connector.fields.some((field) => field.required)).toBe(true);
      }
    }
  });

  it("weist unbekannte Schlüssel ab", () => {
    expect(isConnectorKey("gibtesnicht")).toBe(false);
    expect(getConnector("gibtesnicht")).toBeUndefined();
  });
});

describe("Reifegrad", () => {
  it("vergibt jedem Modul einen Reifegrad", () => {
    for (const module of MODULE_DEFINITIONS) {
      expect(MODULE_STAGES).toContain(module.stage);
    }
  });

  it("liefert Erprobungsmodule getrennt aus", () => {
    const beta = betaModules();

    expect(beta.every((module) => module.stage === "beta")).toBe(true);
    expect(beta.map((module) => module.key).every(isBeta)).toBe(true);
  });

  it("erkennt unbekannte Schlüssel nicht als Erprobung", () => {
    expect(isBeta("gibtesnicht")).toBe(false);
  });

  it("liefert kein Kernmodul als Erprobung aus", () => {
    // Ein Kernmodul lässt sich nicht abschalten - als Erprobung wäre es
    // unentrinnbar.
    expect(betaModules().some((module) => module.core)).toBe(false);
  });
});
