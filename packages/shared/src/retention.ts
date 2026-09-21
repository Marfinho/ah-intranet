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

export type RetentionMode = "delete" | "anonymize" | "keep";

export interface RetentionRule {
  key: string;
  label: string;
  /** Was in dieser Datenart steht. */
  description: string;
  /**
   * `delete`: Der Aufräumlauf entfernt Datensätze nach `days` Tagen.
   * `anonymize`: Der Datensatz bleibt, verliert aber seinen Personenbezug -
   * für Anker aufbewahrungspflichtiger Vorgänge, die ein hartes Löschen
   * mitreißen würde.
   * `keep`: Wird bewusst nicht automatisch angefasst - die Begründung steht in
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
    label: "Abwesenheiten (ohne Krankmeldungen)",
    description: "Urlaub, Gleitzeit, Sonderurlaub, Fortbildung.",
    mode: "delete",
    days: 3 * JAHR,
    reason:
      "Urlaubsansprüche verjähren regelmäßig in drei Jahren. Aufzeichnungen zur Arbeitszeit verlangt § 16 Abs. 2 ArbZG zwei Jahre - die längere Frist gilt.",
  },
  {
    key: "absence_sick",
    label: "Krankmeldungen",
    description: "Die Tatsache der Arbeitsunfähigkeit, ohne Diagnose.",
    mode: "delete",
    days: JAHR,
    reason:
      "Auch ohne Diagnose ist die Arbeitsunfähigkeit ein Gesundheitsdatum nach Art. 9 Abs. 1 DSGVO und verlangt die strengere Behandlung. Die Begründung der übrigen Abwesenheiten - Verjährung von Urlaubsansprüchen - trägt hier nicht: ein Krankheitstag begründet keinen Anspruch, der in drei Jahren verjährt. Ein Jahr deckt die Zuordnung innerhalb des Entgeltfortzahlungszeitraums und den Jahresvergleich ab; danach überwiegt der Personenbezug deutlich.",
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
    key: "shift",
    label: "Schichtplan und Diensttausch",
    description: "Geplante Besetzung je Standort und Abteilung, samt Tauschvorgängen und Freigaben.",
    mode: "delete",
    days: 2 * JAHR,
    reason:
      "Der Schichtplan ist eine Planung, kein Arbeitszeitnachweis. Die Frist folgt trotzdem § 16 Abs. 2 ArbZG, weil der Plan im Streitfall über die geleistete Arbeitszeit als Anhaltspunkt dient - danach überwiegt der Personenbezug.",
  },
  {
    key: "custody",
    label: "Verwahrung von Fundsachen und Schlüsseln",
    description: "Aufnahme, Ausgabe, Rücknahme und Abholung mit handelnder Person und Zeitstempel.",
    mode: "delete",
    days: 3 * JAHR,
    reason:
      "Schlüsselübergaben sind sicherheitsrelevant und müssen sich über längere Zeit zurückverfolgen lassen. Für Fundsachen endet das Interesse früher (§§ 965 ff. BGB), die Frist richtet sich deshalb nach dem strengeren Fall.",
  },
  {
    key: "meal_order",
    label: "Essensbestellungen",
    description: "Wer an welchem Tag was bestellt hat.",
    mode: "delete",
    days: 90,
    reason:
      "Nach der Abrechnung des Monats ohne Zweck. Kurze Frist, weil sich aus Essgewohnheiten Rückschlüsse auf Gesundheit und Religion ziehen lassen - das ist mehr Personenbezug, als die Sache wert ist.",
  },
  {
    key: "employment",
    label: "Personalstammdaten aktiver Konten",
    description: "Name, Kontakt, Standort, Abteilung, Rollen von Beschäftigten im Haus.",
    mode: "keep",
    days: 10 * JAHR,
    reason:
      "Solange das Arbeitsverhältnis besteht, ist die Verarbeitung für dessen Durchführung erforderlich (§ 26 Abs. 1 BDSG). Eine Frist greift deshalb erst, wenn das Konto auf inaktiv gesetzt wird - siehe die folgende Regel.",
  },
  {
    key: "employment_inactive",
    label: "Personalstammdaten ausgeschiedener Konten",
    description: "Konten, die auf inaktiv gesetzt wurden - Austritt, Elternzeit, längeres Ruhen.",
    mode: "anonymize",
    days: 3 * JAHR,
    reason:
      "Mit dem Ende des Beschäftigungsverhältnisses endet der Zweck nach § 26 Abs. 1 BDSG; die Fristen der Lohnunterlagen betreffen die Lohnbuchhaltung, nicht das Intranet. Drei Jahre decken die regelmäßige Verjährung ab und laufen mit dem Audit-Log gleich. Anonymisiert statt gelöscht, weil Bestellungen und Freigaben dieser Person zehn Jahre nachvollziehbar bleiben müssen - das Konto bleibt als Anker ohne Identität.",
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

/** Datenarten, die der Aufräumlauf anonymisiert statt löscht. */
export function anonymizableRules(): RetentionRule[] {
  return RETENTION_RULES.filter((rule) => rule.mode === "anonymize");
}

/** Alles, was der Aufräumlauf anfasst - gleich auf welche Weise. */
export function enforcedRules(): RetentionRule[] {
  return RETENTION_RULES.filter((rule) => rule.mode !== "keep");
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
