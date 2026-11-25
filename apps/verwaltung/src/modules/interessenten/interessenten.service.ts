import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { LEAD_STATUS, PREISLISTE_VERSION } from "@ah-intranet/shared";
import type { Sitzung } from "../../core/decorators";
import { IntranetService } from "../../core/intranet.service";
import { ProtokollService } from "../../core/protokoll.service";
import { abschlussquote, leadHinweise, sortiereHinweise } from "../statistik/regeln";

interface LeadZeile {
  id: string;
  name: string;
  ansprechperson: string | null;
  notiz: string | null;
  status: string;
  tokenGueltigBis: Date;
  tokenWiderrufenAm: Date | null;
  anzahlHaeuser: number;
  anzahlNutzer: number;
  keyUser: number | null;
  tier: string | null;
  module: string[];
  angefragtAm: Date | null;
  hausId: string | null;
  preislisteVersion: string | null;
  monatlichCent: number | null;
  createdAt: Date;
  updatedAt: Date;
  standorte: number;
}

/** Der Linkhash (`tokenHash`) wird nie ausgewählt - weder hier noch von der Datenbankrolle zugelassen. */
const SPALTEN = `l.id, l.name, l.ansprechperson, l.notiz, l.status::text AS status, l."tokenGueltigBis", l."tokenWiderrufenAm",
  l."anzahlHaeuser", l."anzahlNutzer", l."keyUser", l.tier, l.module, l."angefragtAm", l."hausId", l."preislisteVersion",
  (l.angebot -> 'monatlich' ->> 'summeCent')::bigint::int AS "monatlichCent", l."createdAt", l."updatedAt",
  (SELECT count(*) FROM "LeadStandort" s WHERE s."leadId" = l.id)::int AS standorte`;

@Injectable()
export class InteressentenService {
  constructor(
    private readonly intranet: IntranetService,
    private readonly protokoll: ProtokollService,
  ) {}

  async liste() {
    const zeilen = await this.intranet.abfrage<LeadZeile>(
      `SELECT ${SPALTEN} FROM "Lead" l ORDER BY l."updatedAt" DESC`,
    );
    return zeilen.map((zeile) => this.anreichern(zeile));
  }

  async detail(id: string) {
    const zeile = await this.intranet.eine<LeadZeile>(`SELECT ${SPALTEN} FROM "Lead" l WHERE l.id = $1`, [id]);
    if (!zeile) throw new NotFoundException("Interessent nicht gefunden");
    const standorte = await this.intranet.abfrage(
      `SELECT name, strasse, plz, ort, marken, leistungen, campus FROM "LeadStandort" WHERE "leadId" = $1 ORDER BY position`,
      [id],
    );
    return { ...this.anreichern(zeile), standortListe: standorte, aktuellePreisliste: PREISLISTE_VERSION };
  }

  /** Trichter, Quoten und Volumen über alle Interessenten. */
  async auswertung() {
    const [trichter, volumen, tiers, dauer] = await Promise.all([
      this.intranet.abfrage<{ status: string; anzahl: number }>(
        `SELECT status::text, count(*)::int AS anzahl FROM "Lead" GROUP BY 1`,
      ),
      this.intranet.abfrage<{ status: string; cent: number; haeuser: number; nutzer: number }>(
        `SELECT status::text, coalesce(sum((angebot -> 'monatlich' ->> 'summeCent')::bigint), 0)::int AS cent,
                coalesce(sum("anzahlHaeuser"), 0)::int AS haeuser, coalesce(sum("anzahlNutzer"), 0)::int AS nutzer
           FROM "Lead" GROUP BY 1`,
      ),
      this.intranet.abfrage<{ tier: string; anzahl: number }>(
        `SELECT coalesce(tier, 'einzelwahl') AS tier, count(*)::int AS anzahl FROM "Lead" GROUP BY 1 ORDER BY 2 DESC`,
      ),
      this.intranet.eine<{ tage: number | null }>(
        `SELECT round(avg(extract(epoch FROM ("angefragtAm" - "createdAt")) / 86400)::numeric, 1)::float AS tage
           FROM "Lead" WHERE "angefragtAm" IS NOT NULL`,
      ),
    ]);
    const stufen = LEAD_STATUS.map((status) => ({
      status,
      anzahl: trichter.find((zeile) => zeile.status === status)?.anzahl ?? 0,
      monatlichCent: volumen.find((zeile) => zeile.status === status)?.cent ?? 0,
      haeuser: volumen.find((zeile) => zeile.status === status)?.haeuser ?? 0,
      nutzer: volumen.find((zeile) => zeile.status === status)?.nutzer ?? 0,
    }));
    const offen = stufen.filter((stufe) => ["entwurf", "versendet", "angefragt"].includes(stufe.status));
    return {
      trichter: stufen,
      abschlussquote: abschlussquote(stufen),
      offenesVolumenCent: offen.reduce((summe, stufe) => summe + stufe.monatlichCent, 0),
      gewonnenesVolumenCent: stufen.find((stufe) => stufe.status === "gewonnen")?.monatlichCent ?? 0,
      tageBisAnfrage: dauer?.tage ?? null,
      tiers,
    };
  }

  async hinweise() {
    const zeilen = await this.intranet.abfrage<LeadZeile>(
      `SELECT ${SPALTEN} FROM "Lead" l WHERE l.status IN ('entwurf','versendet','angefragt')`,
    );
    return zeilen.flatMap((zeile) => leadHinweise(zeile));
  }

  async setzeStatus(wer: Sitzung, id: string, status: string) {
    if (!(LEAD_STATUS as readonly string[]).includes(status)) throw new BadRequestException("Unbekannter Status");
    const lead = await this.hole(id);
    await this.intranet.abfrage(`UPDATE "Lead" SET status = $2::"LeadStatus", "updatedAt" = now() WHERE id = $1`, [
      id,
      status,
    ]);
    await this.protokoll.schreibe(
      wer,
      "interessent.status",
      "interessent",
      id,
      `${lead.name}: ${lead.status} → ${status}`,
    );
  }

  async setzeNotiz(wer: Sitzung, id: string, notiz: string | null) {
    const lead = await this.hole(id);
    await this.intranet.abfrage(`UPDATE "Lead" SET notiz = $2, "updatedAt" = now() WHERE id = $1`, [
      id,
      notiz?.trim() || null,
    ]);
    await this.protokoll.schreibe(wer, "interessent.notiz", "interessent", id, `${lead.name}: Notiz geändert`);
  }

  /** Widerruft den Link; die Pitch-Seite antwortet danach wie bei einem Link, den es nie gab. */
  async widerrufeLink(wer: Sitzung, id: string) {
    const lead = await this.hole(id);
    await this.intranet.abfrage(
      `UPDATE "Lead" SET "tokenWiderrufenAm" = now(), "updatedAt" = now() WHERE id = $1 AND "tokenWiderrufenAm" IS NULL`,
      [id],
    );
    await this.protokoll.schreibe(
      wer,
      "interessent.link-widerrufen",
      "interessent",
      id,
      `${lead.name}: Link widerrufen`,
    );
  }

  private anreichern(zeile: LeadZeile) {
    return {
      ...zeile,
      linkWiderrufen: zeile.tokenWiderrufenAm !== null,
      hinweise: sortiereHinweise(leadHinweise(zeile)),
    };
  }

  private async hole(id: string) {
    const lead = await this.intranet.eine<{ id: string; name: string; status: string }>(
      `SELECT id, name, status::text AS status FROM "Lead" WHERE id = $1`,
      [id],
    );
    if (!lead) throw new NotFoundException("Interessent nicht gefunden");
    return lead;
  }
}
