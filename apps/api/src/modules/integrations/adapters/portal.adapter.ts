import { Injectable } from "@nestjs/common";
import {
  ConnectorError,
  type CheckResult,
  type ConnectorAdapter,
  type ConnectorContext,
  type SyncResult,
} from "../adapter";

/**
 * Konnektoren ohne Datenaustausch: Group Retail Portal, ElsaPro, ETKA, ODIS.
 *
 * Diese Systeme bieten Drittsoftware keine Schnittstelle. Sinnvoll ist allein
 * der gepflegte Absprung aus dem Intranet, damit Mitarbeitende die Adressen
 * nicht als Lesezeichen sammeln. Geprüft wird deshalb nur, ob eine plausible
 * Adresse hinterlegt ist - ein Erreichbarkeitstest wäre wertlos, weil die
 * Portale ohnehin eine persönliche Anmeldung verlangen.
 */
@Injectable()
export class PortalLinkAdapter implements ConnectorAdapter {
  readonly key = "__portal__";

  async check(context: ConnectorContext): Promise<CheckResult> {
    const url = context.settings.portalUrl?.trim();
    if (!url) {
      return { ok: false, message: "Es ist keine Portaladresse hinterlegt." };
    }

    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        return { ok: false, message: "Die Adresse muss mit http:// oder https:// beginnen." };
      }
      return {
        ok: true,
        message: `Absprung eingerichtet: ${parsed.origin}. Die Anmeldung erfolgt personenbezogen im Portal.`,
      };
    } catch {
      return { ok: false, message: "Die hinterlegte Adresse ist keine gültige URL." };
    }
  }

  async run(capability: string): Promise<SyncResult> {
    throw new ConnectorError(
      `Dieses System tauscht keine Daten mit Drittsoftware aus; "${capability}" ist dafür nicht vorgesehen.`,
    );
  }
}
