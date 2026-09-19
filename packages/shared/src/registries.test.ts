import { describe, expect, it } from "vitest";
import {
  CORE_MODULE_KEYS,
  MODULE_DEFINITIONS,
  MODULE_GROUP_LABELS,
  MODULE_STAGES,
  PERMISSION_KEYS,
  ROLE_DEFINITIONS,
  UNVERZICHTBARE_RECHTE,
  betaModules,
  getDependentModules,
  getModule,
  getPermission,
  isBeta,
  isModuleKey,
  isPermissionKey,
} from "./index";

/**
 * Die Registries sind die einzige Quelle der Wahrheit für Module, Rollen und
 * Rechte. Ein Tippfehler dort wirkt sich auf Navigation, Guards und
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

describe("Rechte", () => {
  it("kennt zu jedem Rechteschlüssel eine Beschreibung", () => {
    for (const key of PERMISSION_KEYS) {
      expect(getPermission(key)?.name).toBeTruthy();
      expect(isPermissionKey(key)).toBe(true);
    }
  });

  it("vergibt nur bekannte Rechte an Rollen", () => {
    for (const role of ROLE_DEFINITIONS) {
      for (const key of role.permissions) {
        expect(isPermissionKey(key)).toBe(true);
      }
    }
  });

  it("hält die unverzichtbaren Rechte in der Administrationsrolle", () => {
    // Ohne diese Zusicherung könnte ein frisch eingerichtetes Haus niemanden
    // haben, der die Rechteverwaltung erreicht.
    const admin = ROLE_DEFINITIONS.find((role) => role.key === "admin")!;
    for (const recht of UNVERZICHTBARE_RECHTE) {
      expect(admin.permissions).toContain(recht);
    }
  });

  it("kennt kein Recht ohne Träger", () => {
    const vergeben = new Set(ROLE_DEFINITIONS.flatMap((role) => role.permissions));
    expect([...PERMISSION_KEYS].filter((key) => !vergeben.has(key))).toEqual([]);
  });
});
