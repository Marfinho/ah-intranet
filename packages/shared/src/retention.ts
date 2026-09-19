/**
 * Aufbewahrungsfristen - einzige Quelle der Wahrheit.
 *
 * Datenschutz verlangt Löschen, Handels- und Steuerrecht verlangen Aufbewahren.
 * Beides gleichzeitig geht nur, wenn je Datenart festgelegt ist, was wie lange
 * bleibt und warum. Diese Tabelle ist diese Festlegung: die Oberfläche zeigt
 * sie, der Aufräumlauf setzt sie um, die Dokumentation verweist auf sie.
 *
 * Die Fristen sind begründete Vorgaben, kein Rechtsrat. Vor dem Produktivbetrieb
 * gehören sie mit der Rechtsberatung und der Arbeitnehmervertretung des Hauses
 * abgeglichen - siehe `docs/datenschutz.md`.
 */

export type RetentionMode = "delete" | "keep";

export interface RetentionRule {
  key: string;
  label: string;
  /** Was in dieser Datenart steht. */
  description: string;
  /**
   * `delete`: Der Aufräumlauf entfernt Datensätze nach `days` Tagen.
   * `keep`: Wird bewusst nicht automatisch gelöscht - die Begründung steht in
   * `reason`. Ohne diese Unterscheidung entstünde der Eindruck, es werde alles
   * gelöscht, während Bestellungen zehn Jahre liegen bleiben müssen.
   */
  mode: RetentionMode;
  /** Frist in Tagen. Bei `keep` die Dauer, die das Recht verlangt. */
  days: number;
  /** Warum genau diese Frist. */
  reason: string;
}

const JAHR = 365;

export const RETENTION_RULES: readonly RetentionRule[] = [
  {
    key: "notification",
    label: "Benachrichtigungen",
    description: "Hinweise auf Freigaben, Tickets und Termine im Posteingang.",
    mode: "delete",
    days: 90,
    reason: "Reiner Zustellweg ohne eigenen Beweiswert. Der Vorgang selbst bleibt in seinem Modul erhalten.",
  },
  {
    key: "news_read",
    label: "Lesebestätigungen",
    description: "Wer welchen Beitrag gelesen hat.",
    mode: "delete",
    days: 180,
    reason:
      "Verhaltensdaten mit hohem Personenbezug und geringem Nutzen nach kurzer Zeit. Kürzer als alles andere, weil sie am ehesten zur Leistungskontrolle taugen.",
  },
  {
    key: "audit_log",
    label: "Audit-Log",
    description: "Protokoll aller fachlich relevanten Aktionen mit Zeitpunkt und handelnder Person.",
    mode: "delete",
    days: 3 * JAHR,
    reason:
      "Nachweis von Änderungen an Rechten, Freigaben und Stammdaten. Drei Jahre decken die regelmäßige Verjährung ab; länger wäre eine Vorratsdatenhaltung über das Personal.",
  },
  {
    key: "room_booking",
    label: "Raumbuchungen",
    description: "Belegung von Besprechungsräumen.",
    mode: "delete",
    days: JAHR,
    reason: "Nach Ablauf des Geschäftsjahres ohne Nutzen; kein handels- oder steuerrechtlicher Bezug.",
  },
  {
    key: "ticket",
    label: "Serviceanfragen",
    description: "Tickets an IT, Haustechnik und Verwaltung samt Verlauf.",
    mode: "delete",
    days: 2 * JAHR,
    reason: "Wiederkehrende Störungen bleiben über zwei Jahre erkennbar, danach überwiegt der Personenbezug.",
  },
  {
    key: "absence",
    label: "Abwesenheiten",
    description: "Urlaub, Gleitzeit, Krankmeldungen ohne Diagnose.",
    mode: "delete",
    days: 3 * JAHR,
    reason:
      "Urlaubsansprüche verjähren regelmäßig in drei Jahren. Aufzeichnungen zur Arbeitszeit verlangt § 16 Abs. 2 ArbZG zwei Jahre - die längere Frist gilt.",
  },
  {
    key: "order",
    label: "Bestellungen und Freigaben",
    description: "Visitenkarten, Arbeitskleidung, Sammelbestellungen mit Freigabeentscheidungen.",
    mode: "keep",
    days: 10 * JAHR,
    reason:
      "Buchungsrelevante Unterlagen. § 147 AO und § 257 HGB verlangen zehn Jahre Aufbewahrung - eine Löschung auf Wunsch ist hier ausgeschlossen, die Person wird stattdessen anonymisiert.",
  },
  {
    key: "employment",
    label: "Personalstammdaten",
    description: "Name, Kontakt, Standort, Abteilung, Rollen.",
    mode: "keep",
    days: 10 * JAHR,
    reason:
      "Solange das Arbeitsverhältnis besteht, ist die Verarbeitung für dessen Durchführung erforderlich. Danach greifen die Fristen der Lohnunterlagen; das Intranet anonymisiert und hält keine Personalakte.",
  },
];

export const RETENTION_KEYS: readonly string[] = RETENTION_RULES.map((rule) => rule.key);

export function getRetentionRule(key: string): RetentionRule | undefined {
  return RETENTION_RULES.find((rule) => rule.key === key);
}

/** Datenarten, die der Aufräumlauf tatsächlich löscht. */
export function deletableRules(): RetentionRule[] {
  return RETENTION_RULES.filter((rule) => rule.mode === "delete");
}

/**
 * Stichtag einer Frist: alles davor darf weg.
 *
 * Bewusst als reine Funktion mit übergebenem `now`, damit der Aufräumlauf
 * prüfbar ist, ohne die Systemzeit zu verstellen.
 */
export function cutoffDate(rule: RetentionRule, now: Date = new Date()): Date {
  return new Date(now.getTime() - rule.days * 24 * 60 * 60 * 1000);
}
