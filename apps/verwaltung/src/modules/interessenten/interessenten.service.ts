import { randomUUID } from "node:crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  LEAD_STATUS,
  PREISLISTE_VERSION,
  bereinigeKonfiguration,
  formatStandortText,
  isTierKey,
  parseStandortText,
  type KonfigurationEingabe,
  type LeadStandortItem,
} from "@ah-intranet/shared";
import { HausAnlegenService } from "../haeuser/haus-anlegen.service";
import { LINK_TAGE_STANDARD, hashToken, linkGueltigBis, neuesToken } from "../../core/pitch-link";
import { konfigurationAus, planeHausAusLead, type LeadFuerHaus } from "./haus-vorschau";
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
    private readonly haus: HausAnlegenService,
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
    const standorte = await this.standorte(id);
    return {
      ...this.anreichern(zeile),
      standortListe: standorte,
      standorteText: formatStandortText(standorte),
      aktuellePreisliste: PREISLISTE_VERSION,
    };
  }

  private standorte(leadId: string): Promise<(LeadStandortItem & { id: string })[]> {
    return this.intranet.abfrage(
      `SELECT id, name, strasse, plz, ort, marken, leistungen, oeffnungszeiten, campus, vorschlag FROM "LeadStandort" WHERE "leadId" = $1 ORDER BY position`,
      [leadId],
    );
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

  /* ---------------------------------------------------- Anlegen und Ändern */

  /** Der Mandant, in dem Interessenten wohnen: der des Betreibers, über dessen Adresse die Pitch-Seite erreichbar ist. */
  private async betreiberMandant(): Promise<string> {
    const zeilen = await this.intranet.abfrage<{ id: string }>(
      `SELECT t.id FROM "Tenant" t WHERE EXISTS (SELECT 1 FROM "User" u WHERE u."tenantId" = t.id AND u."isPlatformAdmin")`,
    );
    if (zeilen.length !== 1) {
      throw new BadRequestException(
        zeilen.length === 0
          ? "Es gibt keinen Betreiber-Mandanten in der Kunden-Anwendung (pnpm --filter api prisma:einrichten). Dort wohnt die Pitch-Seite."
          : "Es gibt mehrere Betreiber-Mandanten - die Zuordnung der Pitch-Seite ist nicht eindeutig.",
      );
    }
    return zeilen[0].id;
  }

  private pitchAdresse(token: string): string {
    const basis = process.env.PITCH_BASIS_URL?.replace(/\/$/, "");
    return basis ? `${basis}/angebot/${token}` : `/angebot/${token}`;
  }

  private async schreibeStandorte(
    client: { query: (sql: string, werte: unknown[]) => Promise<unknown> },
    mandant: string,
    leadId: string,
    liste: LeadStandortItem[],
  ) {
    let position = 0;
    for (const haus of liste) {
      await client.query(
        `INSERT INTO "LeadStandort" (id, "tenantId", "leadId", position, name, strasse, plz, ort, marken, leistungen, oeffnungszeiten, campus, vorschlag, "updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, now())`,
        [
          randomUUID(),
          mandant,
          leadId,
          position++,
          haus.name,
          haus.strasse,
          haus.plz,
          haus.ort,
          haus.marken,
          haus.leistungen,
          haus.oeffnungszeiten,
          haus.campus,
          haus.vorschlag,
        ],
      );
    }
  }

  /** Legt einen Interessenten an. Der Klartext des Links steht nur in dieser Antwort. */
  async anlegen(
    wer: Sitzung,
    eingabe: {
      name: string;
      ansprechperson?: string | null;
      notiz?: string | null;
      standorteText: string;
      linkTage?: number;
      nutzer?: number;
      tier?: string | null;
    },
  ) {
    const liste = parseStandortText(eingabe.standorteText);
    if (liste.length === 0) throw new BadRequestException("Bitte mindestens ein Haus angeben.");
    const mandant = await this.betreiberMandant();
    const token = neuesToken();
    const id = randomUUID();
    const haeuser = Math.max(1, liste.length);
    await this.intranet.transaktion(async (client) => {
      await client.query(
        `INSERT INTO "Lead" (id, "tenantId", name, ansprechperson, notiz, "tokenHash", "tokenGueltigBis", "anzahlHaeuser", "anzahlNutzer", tier, "updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now())`,
        [
          id,
          mandant,
          eingabe.name.trim(),
          eingabe.ansprechperson?.trim() || null,
          eingabe.notiz?.trim() || null,
          hashToken(token),
          linkGueltigBis(eingabe.linkTage ?? LINK_TAGE_STANDARD),
          haeuser,
          // Startwert für die Pitch-Seite; der Interessent stellt seine Zahl selbst ein.
          Math.max(1, Math.floor(eingabe.nutzer ?? 25 * haeuser)),
          // Ein Pitch beginnt beim mittleren Paket: dort liegt der Nutzen.
          eingabe.tier && isTierKey(eingabe.tier) ? eingabe.tier : "prozesse",
        ],
      );
      await this.schreibeStandorte(client, mandant, id, liste);
    });
    await this.protokoll.schreibe(
      wer,
      "interessent.anlegen",
      "interessent",
      id,
      `${eingabe.name.trim()}: angelegt (${liste.length} Häuser)`,
    );
    return { id, token, adresse: this.pitchAdresse(token) };
  }

  async aendern(
    wer: Sitzung,
    id: string,
    eingabe: {
      name?: string;
      ansprechperson?: string | null;
      notiz?: string | null;
      standorteText?: string;
      konfiguration?: KonfigurationEingabe;
    },
  ) {
    const bisher = await this.ladeFuerHaus(id);
    const mandant = await this.mandantVon(id);
    const felder: string[] = [];
    const werte: unknown[] = [id];
    const setze = (spalte: string, wert: unknown) => {
      werte.push(wert);
      felder.push(`${spalte} = $${werte.length}`);
    };
    if (eingabe.name !== undefined) setze("name", eingabe.name.trim());
    if (eingabe.ansprechperson !== undefined) setze("ansprechperson", eingabe.ansprechperson?.trim() || null);
    if (eingabe.notiz !== undefined) setze("notiz", eingabe.notiz?.trim() || null);
    if (eingabe.konfiguration) {
      const neu = bereinigeKonfiguration(eingabe.konfiguration, konfigurationAus(bisher));
      setze('"anzahlHaeuser"', neu.haeuser);
      setze('"anzahlNutzer"', neu.nutzer);
      setze('"keyUser"', neu.keyUser);
      setze("tier", neu.tier);
      setze("module", neu.module);
    }
    const liste = eingabe.standorteText === undefined ? null : parseStandortText(eingabe.standorteText);
    if (liste && liste.length === 0) throw new BadRequestException("Bitte mindestens ein Haus angeben.");
    // Wer die Häuser neu festlegt, verwirft die Änderungen des Interessenten (wie bisher).
    if (liste) felder.push('"kundenStandorte" = NULL');

    await this.intranet.transaktion(async (client) => {
      if (felder.length > 0 || liste) {
        await client.query(`UPDATE "Lead" SET ${[...felder, '"updatedAt" = now()'].join(", ")} WHERE id = $1`, werte);
      }
      if (liste) {
        await client.query(`DELETE FROM "LeadStandort" WHERE "leadId" = $1`, [id]);
        await this.schreibeStandorte(client, mandant, id, liste);
      }
    });
    await this.protokoll.schreibe(wer, "interessent.aendern", "interessent", id, `${bisher.name}: geändert`);
  }

  /** Neuer Link; der alte gilt sofort nicht mehr. */
  async neuerLink(wer: Sitzung, id: string, tage?: number) {
    const lead = await this.hole(id);
    const token = neuesToken();
    await this.intranet.abfrage(
      `UPDATE "Lead" SET "tokenHash" = $2, "tokenGueltigBis" = $3, "tokenWiderrufenAm" = NULL, "updatedAt" = now() WHERE id = $1`,
      [id, hashToken(token), linkGueltigBis(tage ?? LINK_TAGE_STANDARD)],
    );
    await this.protokoll.schreibe(
      wer,
      "interessent.link",
      "interessent",
      id,
      `${lead.name}: neuer Link, der bisherige ist ungültig`,
    );
    return { token, adresse: this.pitchAdresse(token) };
  }

  async loeschen(wer: Sitzung, id: string) {
    const lead = await this.hole(id);
    await this.intranet.transaktion(async (client) => {
      await client.query(`DELETE FROM "LeadStandort" WHERE "leadId" = $1`, [id]);
      await client.query(`DELETE FROM "Lead" WHERE id = $1`, [id]);
    });
    await this.protokoll.schreibe(wer, "interessent.loeschen", "interessent", id, `${lead.name}: gelöscht`);
  }

  /* --------------------------------------------------------- Haus anlegen */

  async hausVorschau(id: string) {
    return planeHausAusLead(await this.ladeFuerHaus(id));
  }

  /**
   * Legt aus dem Interessenten das Haus an: Standorte, Marken, Abteilungen,
   * Module und Lizenzkontingent kommen aus seinen Angaben. Ein Interessent wird
   * höchstens einmal zum Haus.
   */
  async hausAnlegen(
    wer: Sitzung,
    id: string,
    eingabe: {
      slug: string;
      domain?: string;
      adminUsername: string;
      adminPassword: string;
      adminFirstName?: string;
      adminLastName?: string;
      adminEmail?: string;
    },
  ) {
    const lead = await this.ladeFuerHaus(id);
    if (lead.hausId) throw new BadRequestException("Aus diesem Interessenten wurde bereits ein Haus angelegt.");
    if (lead.standorte.length === 0)
      throw new BadRequestException("Ohne Häuser lässt sich kein Mandant anlegen. Bitte zuerst Häuser erfassen.");
    const vorschau = planeHausAusLead(lead);

    // Reservieren, bevor das Haus entsteht: zwei gleichzeitige Aufrufe lesen beide
    // „noch kein Haus“. Das Update mit Bedingung entscheidet in der Datenbank.
    const reservierung = `wird-angelegt:${randomUUID()}`;
    const reserviert = await this.intranet.abfrage(
      `UPDATE "Lead" SET "hausId" = $2 WHERE id = $1 AND "hausId" IS NULL RETURNING id`,
      [id, reservierung],
    );
    if (reserviert.length === 0) {
      throw new BadRequestException(
        "Aus diesem Interessenten wird gerade ein Haus angelegt oder wurde bereits eines angelegt.",
      );
    }

    let ergebnis: { tenantId: string; slug: string; name: string };
    try {
      ergebnis = await this.haus.anlegen(wer, {
        ...eingabe,
        name: lead.name,
        notes: `Aus Interessent ${id}`,
        licensedSeats: vorschau.lizenzen,
        // Häuser kosten nur Einrichtung, keine Gebühr: eine Obergrenze wäre erfunden.
        locationLimit: null,
        vorlage: { plan: vorschau.plan, module: vorschau.moduleZustand },
      });
    } catch (fehler) {
      // Misslungen (z. B. Kennung vergeben): Reservierung lösen, damit es erneut geht.
      await this.intranet.abfrage(`UPDATE "Lead" SET "hausId" = NULL WHERE id = $1 AND "hausId" = $2`, [
        id,
        reservierung,
      ]);
      throw fehler;
    }
    await this.intranet.abfrage(
      `UPDATE "Lead" SET "hausId" = $2, status = 'gewonnen', "updatedAt" = now() WHERE id = $1`,
      [id, ergebnis.tenantId],
    );
    await this.protokoll.schreibe(
      wer,
      "interessent.haus",
      "interessent",
      id,
      `${lead.name}: Haus ${ergebnis.slug} angelegt (${vorschau.plan.standorte.length} Standorte, ${vorschau.lizenzen} Lizenzen)`,
    );
    return ergebnis;
  }

  private async mandantVon(id: string): Promise<string> {
    const zeile = await this.intranet.eine<{ tenantId: string }>(`SELECT "tenantId" FROM "Lead" WHERE id = $1`, [id]);
    if (!zeile) throw new NotFoundException("Interessent nicht gefunden");
    return zeile.tenantId;
  }

  private async ladeFuerHaus(id: string): Promise<LeadFuerHaus> {
    const zeile = await this.intranet.eine<Omit<LeadFuerHaus, "standorte">>(
      `SELECT name, "anzahlHaeuser", "anzahlNutzer", "keyUser", tier, module, "hausId", "kundenStandorte" FROM "Lead" WHERE id = $1`,
      [id],
    );
    if (!zeile) throw new NotFoundException("Interessent nicht gefunden");
    return { ...zeile, standorte: await this.standorte(id) };
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
