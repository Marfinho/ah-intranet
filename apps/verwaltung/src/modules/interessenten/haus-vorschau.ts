import {
  berechneAngebot,
  betaModules,
  bereinigeKundenStandorte,
  isTierKey,
  modulEinstellungen,
  planeHaus,
  vorschlagKennung,
  type HausVorschau,
  type PitchStandortEingabe,
  type LeadKonfiguration,
} from "@ah-intranet/shared";

/** Die Felder eines Interessenten, aus denen ein Haus entsteht. */
export interface LeadFuerHaus {
  name: string;
  anzahlHaeuser: number;
  anzahlNutzer: number;
  keyUser: number | null;
  tier: string | null;
  module: string[];
  hausId: string | null;
  kundenStandorte: unknown;
  standorte: {
    name: string;
    strasse: string | null;
    plz: string | null;
    ort: string | null;
    marken: string[];
    leistungen: string[];
  }[];
}

export function konfigurationAus(
  lead: Pick<LeadFuerHaus, "anzahlHaeuser" | "anzahlNutzer" | "keyUser" | "tier" | "module">,
): LeadKonfiguration {
  return {
    haeuser: lead.anzahlHaeuser,
    nutzer: lead.anzahlNutzer,
    keyUser: lead.keyUser,
    tier: lead.tier && isTierKey(lead.tier) ? lead.tier : null,
    module: lead.module,
  };
}

/**
 * Was aus dem Interessenten würde - dieselbe Rechnung für die Vorschau und für
 * das Anlegen, damit entsteht, was die Vorschau zeigt. Hat der Interessent seine
 * Häuser verändert, ist das Angebot auf ihnen gerechnet: sie gelten.
 */
export function planeHausAusLead(lead: LeadFuerHaus): HausVorschau {
  const konf = konfigurationAus(lead);
  const angebot = berechneAngebot(konf);
  const veraendert = Array.isArray(lead.kundenStandorte)
    ? bereinigeKundenStandorte(lead.kundenStandorte as PitchStandortEingabe[])
    : [];
  const plan = planeHaus(
    veraendert.length > 0
      ? veraendert.map((haus) => ({
          name: haus.name,
          strasse: haus.adresse,
          marken: haus.marken,
          leistungen: haus.leistungen,
        }))
      : lead.standorte,
  );
  const moduleZustand = modulEinstellungen(angebot.module);
  return {
    quelle: veraendert.length > 0 ? "interessent" : "betreiber",
    bereitsAngelegt: lead.hausId !== null,
    hausId: lead.hausId,
    kennung: vorschlagKennung(lead.name),
    lizenzen: konf.nutzer,
    plan,
    moduleZustand,
    modulAn: moduleZustand.filter((modul) => modul.enabled).map((modul) => modul.key),
    modulErprobung: konf.tier === "komplett" ? betaModules().map((modul) => modul.key as string) : [],
  };
}
