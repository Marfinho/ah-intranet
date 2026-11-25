import { BadRequestException, Injectable } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { PERMISSION_DEFINITIONS, ROLE_DEFINITIONS, pruefeKennung, type HausPlan } from "@ah-intranet/shared";
import type { Sitzung } from "../../core/decorators";
import { IntranetService } from "../../core/intranet.service";
import { ProtokollService } from "../../core/protokoll.service";

export interface HausEingabe {
  slug: string;
  name: string;
  domain?: string;
  notes?: string;
  adminUsername: string;
  adminPassword: string;
  adminFirstName?: string;
  adminLastName?: string;
  adminEmail?: string;
  licensedSeats?: number | null;
  locationLimit?: number | null;
  /** Standorte, Marken, Abteilungen und Module aus einem Interessenten. Ohne: ein Startpunkt. */
  vorlage?: { plan: HausPlan; module: { key: string; enabled: boolean }[] };
}

/**
 * Legt ein Haus an. Die eigentliche Arbeit macht die Datenbankfunktion
 * `verwaltung_haus_anlegen` (scripts/verwaltung-rolle.sql): sie ist die einzige
 * Schreibberechtigung der Verwaltungsrolle auf die Struktur eines Hauses und
 * kann nur neue Häuser erzeugen, nie ein bestehendes verändern.
 */
@Injectable()
export class HausAnlegenService {
  constructor(
    private readonly intranet: IntranetService,
    private readonly protokoll: ProtokollService,
  ) {}

  async anlegen(wer: Sitzung, eingabe: HausEingabe): Promise<{ tenantId: string; slug: string; name: string }> {
    const slug = eingabe.slug.trim().toLowerCase();
    const fehler = pruefeKennung(slug);
    if (fehler) throw new BadRequestException(fehler);
    if (await this.intranet.eine(`SELECT 1 FROM "Tenant" WHERE slug = $1`, [slug])) {
      throw new BadRequestException(`Die Kennung "${slug}" ist bereits vergeben.`);
    }
    const benutzer = eingabe.adminUsername.trim().toLowerCase();
    if (!benutzer) throw new BadRequestException("Für das erste Administrationskonto wird ein Benutzername gebraucht.");
    if (eingabe.adminPassword.length < 10) {
      throw new BadRequestException("Das Passwort des ersten Kontos muss mindestens 10 Zeichen lang sein.");
    }
    const name = eingabe.name.trim();
    if (!name) throw new BadRequestException("Das Haus braucht einen Namen.");
    if (eingabe.vorlage && eingabe.vorlage.plan.standorte.length === 0) {
      throw new BadRequestException("Ohne mindestens ein Haus lässt sich kein Mandant einrichten.");
    }

    // Außerhalb der Transaktion: bcrypt ist bewusst langsam.
    const passwordHash = await bcrypt.hash(eingabe.adminPassword, 12);
    const vorlage = eingabe.vorlage ?? startpunkt(name);

    let tenantId: string;
    try {
      const zeile = await this.intranet.eine<{ id: string }>(`SELECT public.verwaltung_haus_anlegen($1::jsonb) AS id`, [
        JSON.stringify({
          slug,
          name,
          domain: eingabe.domain?.trim() || null,
          notes: eingabe.notes?.trim() || null,
          licensedSeats: eingabe.licensedSeats ?? null,
          locationLimit: eingabe.locationLimit ?? null,
          permissions: PERMISSION_DEFINITIONS.map(({ key, name: n, description }) => ({ key, name: n, description })),
          roles: ROLE_DEFINITIONS.map((rolle) => ({
            key: rolle.key,
            name: rolle.name,
            description: rolle.description,
            rank: rolle.rank,
            permissions: rolle.permissions,
          })),
          plan: vorlage.plan,
          module: vorlage.module.length > 0 ? vorlage.module : null,
          admin: {
            username: benutzer,
            email: eingabe.adminEmail?.trim() || null,
            passwordHash,
            firstName: eingabe.adminFirstName?.trim() || "Administration",
            lastName: eingabe.adminLastName?.trim() || name,
          },
        }),
      ]);
      tenantId = zeile!.id;
    } catch (fehlerDb) {
      // Eindeutigkeit (Kennung oder Domain) entscheidet die Datenbank; zwei gleichzeitige Anlagen scheitern hier.
      if ((fehlerDb as { code?: string }).code === "23505") {
        throw new BadRequestException("Kennung oder Domain sind bereits vergeben.");
      }
      throw fehlerDb;
    }

    await this.protokoll.schreibe(
      wer,
      "haus.anlegen",
      "haus",
      tenantId,
      `Haus "${name}" (${slug}) angelegt, erstes Konto "${benutzer}"`,
    );
    return { tenantId, slug, name };
  }
}

/** Ein Standort und eine Abteilung - benennen und ergänzen kann sie das Haus danach selbst. */
function startpunkt(name: string): { plan: HausPlan; module: { key: string; enabled: boolean }[] } {
  return {
    plan: {
      standorte: [{ name, code: "HB", adresse: null, marken: [], abteilungen: ["VWL"] }],
      marken: [],
      abteilungen: [{ name: "Verwaltung", code: "VWL" }],
    },
    module: [],
  };
}
