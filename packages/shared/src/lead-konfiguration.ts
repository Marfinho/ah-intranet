import { berechneAngebot, isTierKey, waehlbareModule } from "./preise";
import type { LeadKonfiguration } from "./leads";
import type { PitchStandortEingabe } from "./pitch-vorschlag";

export interface KonfigurationEingabe {
  haeuser?: number;
  nutzer?: number;
  keyUser?: number | null;
  tier?: string | null;
  module?: string[];
  /** Nur von der Pitch-Seite: die Häuser, wie der Interessent sie verändert hat. */
  standorte?: PitchStandortEingabe[];
}

/**
 * Die Konfiguration, wie der Interessent sie einstellen darf.
 *
 * Alles, was von der Pitch-Seite kommt, läuft hier durch: unbekannte Tiers
 * werden verworfen, Module auf die waehlbaren beschränkt. Erprobungen und
 * Kernmodule stehen nicht zur Wahl - die Seite wäre sonst ein Weg, sich
 * Module zuzuschreiben, die nur der Betreiber freigeben darf.
 */
export function bereinigeKonfiguration(eingabe: KonfigurationEingabe, bisher: LeadKonfiguration): LeadKonfiguration {
  const waehlbar = new Set(waehlbareModule().map((modul) => modul.key as string));
  const tier = eingabe.tier === undefined ? bisher.tier : eingabe.tier && isTierKey(eingabe.tier) ? eingabe.tier : null;
  const module =
    eingabe.module === undefined ? bisher.module : [...new Set(eingabe.module.filter((key) => waehlbar.has(key)))];
  const angebot = berechneAngebot({
    haeuser: eingabe.haeuser ?? bisher.haeuser,
    nutzer: eingabe.nutzer ?? bisher.nutzer,
    keyUser: eingabe.keyUser === undefined ? bisher.keyUser : eingabe.keyUser,
    tier,
    module,
  });
  return {
    haeuser: angebot.haeuser,
    nutzer: angebot.nutzer,
    keyUser: eingabe.keyUser === undefined ? bisher.keyUser : eingabe.keyUser === null ? null : angebot.keyUser,
    tier,
    module,
  };
}
