import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Lead, LeadStandort, Prisma } from "@prisma/client";
import {
  PREISLISTE_VERSION,
  berechneAngebot,
  betaModules,
  formatEuro,
  isTierKey,
  waehlbareModule,
  type Angebot,
  type HausVorschau,
  type LeadDetail,
  type LeadKonfiguration,
  type LeadStandortItem,
  type LeadStatusKey,
  type LeadSummary,
  type PitchAnsicht,
  type TierKey,
} from "@ah-intranet/shared";
import { AuditService } from "../../core/audit.service";
import { NotificationsService } from "../../core/notifications.service";
import { PrismaService } from "../../core/prisma.service";
import type { RequestUser } from "../../core/request-user";
import { currentTenant } from "../../core/tenant-context";
import { TenantService } from "../../core/tenant.service";
import { modulEinstellungen, planeHaus, vorschlagKennung } from "./haus-aus-interessent";
import {
  LINK_TAGE_STANDARD,
  hashToken,
  linkGueltigBis,
  linkIstGueltig,
  neuesToken,
  vorschlagFuerStandort,
} from "./pitch-regeln";

type LeadMitStandorten = Lead & { standorte: LeadStandort[] };

export interface StandortEingabe {
  name: string;
  strasse?: string | null;
  plz?: string | null;
  ort?: string | null;
  marken?: string[];
  leistungen?: string[];
  oeffnungszeiten?: string | null;
  campus?: string | null;
  vorschlag?: string | null;
}

export interface KonfigurationEingabe {
  haeuser?: number;
  nutzer?: number;
  keyUser?: number | null;
  tier?: string | null;
  module?: string[];
}

const leer = (wert: string | null | undefined) => (wert?.trim() ? wert.trim() : null);

/**
 * Die Konfiguration, wie der Interessent sie einstellen darf.
 *
 * Alles, was von der Pitch-Seite kommt, läuft hier durch: unbekannte Tiers
 * werden verworfen, Module auf die wählbaren beschränkt. Erprobungen und
 * Kernmodule stehen nicht zur Wahl - die Seite wäre sonst ein Weg, sich
 * Module zuzuschreiben, die nur der Betreiber freigeben darf.
 */
export function bereinigeKonfiguration(eingabe: KonfigurationEingabe, bisher: LeadKonfiguration): LeadKonfiguration {
  const wählbar = new Set(waehlbareModule().map((modul) => modul.key as string));
  const tier = eingabe.tier === undefined ? bisher.tier : eingabe.tier && isTierKey(eingabe.tier) ? eingabe.tier : null;
  const module =
    eingabe.module === undefined ? bisher.module : [...new Set(eingabe.module.filter((key) => wählbar.has(key)))];
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

const betaKeys = () => betaModules().map((modul) => modul.key as string);

function konfiguration(lead: Lead): LeadKonfiguration {
  return {
    haeuser: lead.anzahlHaeuser,
    nutzer: lead.anzahlNutzer,
    keyUser: lead.keyUser,
    tier: lead.tier && isTierKey(lead.tier) ? lead.tier : null,
    module: lead.module,
  };
}

function rechne(konf: LeadKonfiguration): Angebot {
  return berechneAngebot({
    haeuser: konf.haeuser,
    nutzer: konf.nutzer,
    keyUser: konf.keyUser,
    tier: konf.tier,
    module: konf.module,
  });
}

function standortItem(standort: LeadStandort): LeadStandortItem {
  return {
    id: standort.id,
    name: standort.name,
    strasse: standort.strasse,
    plz: standort.plz,
    ort: standort.ort,
    marken: standort.marken,
    leistungen: standort.leistungen,
    oeffnungszeiten: standort.oeffnungszeiten,
    campus: standort.campus,
    vorschlag: standort.vorschlag,
  };
}

function summary(lead: LeadMitStandorten): LeadSummary {
  return {
    id: lead.id,
    name: lead.name,
    status: lead.status as LeadStatusKey,
    standorte: lead.standorte.length,
    konfiguration: konfiguration(lead),
    angefragtAm: lead.angefragtAm?.toISOString() ?? null,
    linkGueltigBis: lead.tokenGueltigBis.toISOString(),
    linkWiderrufen: lead.tokenWiderrufenAm !== null,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  };
}

function standortDaten(liste: StandortEingabe[]): Prisma.LeadStandortUncheckedCreateWithoutLeadInput[] {
  return liste.map((standort, index) => ({
    position: index,
    name: standort.name.trim(),
    strasse: leer(standort.strasse),
    plz: leer(standort.plz),
    ort: leer(standort.ort),
    marken: (standort.marken ?? []).map((eintrag) => eintrag.trim()).filter(Boolean),
    leistungen: (standort.leistungen ?? []).map((eintrag) => eintrag.trim()).filter(Boolean),
    oeffnungszeiten: leer(standort.oeffnungszeiten),
    campus: leer(standort.campus),
    vorschlag: leer(standort.vorschlag),
  }));
}

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly tenants: TenantService,
  ) {}

  /* ------------------------------------------------- Verwaltung */

  async list(): Promise<LeadSummary[]> {
    const leads = await this.prisma.lead.findMany({
      orderBy: { updatedAt: "desc" },
      include: { standorte: { orderBy: { position: "asc" } } },
    });
    return leads.map(summary);
  }

  async get(id: string): Promise<LeadDetail> {
    return this.detail(await this.laden(id));
  }

  /** Legt einen Interessenten an. Der Klartext des Links steht nur in dieser Antwort. */
  async create(
    actor: RequestUser,
    input: {
      name: string;
      ansprechperson?: string | null;
      notiz?: string | null;
      linkTage?: number;
      standorte: StandortEingabe[];
      nutzer?: number;
      tier?: string | null;
    },
  ) {
    const token = neuesToken();
    const haeuser = Math.max(1, input.standorte.length);
    const lead = await this.prisma.lead.create({
      data: {
        name: input.name.trim(),
        ansprechperson: leer(input.ansprechperson),
        notiz: leer(input.notiz),
        tokenHash: hashToken(token),
        tokenGueltigBis: linkGueltigBis(input.linkTage ?? LINK_TAGE_STANDARD),
        anzahlHaeuser: haeuser,
        // Startwert für die Pitch-Seite; der Interessent stellt seine Zahl selbst ein.
        anzahlNutzer: Math.max(1, Math.floor(input.nutzer ?? 25 * haeuser)),
        // Ein Pitch beginnt beim mittleren Tier: dort liegt der Nutzen.
        tier: input.tier && isTierKey(input.tier) ? input.tier : "prozesse",
        standorte: { create: standortDaten(input.standorte) },
      },
      include: { standorte: { orderBy: { position: "asc" } } },
    });

    await this.audit.log({
      actor,
      action: "lead.create",
      entityType: "lead",
      entityId: lead.id,
      detail: `Interessent "${lead.name}" angelegt (${lead.standorte.length} Häuser)`,
    });

    return { lead: await this.detail(lead), token };
  }

  async update(
    actor: RequestUser,
    id: string,
    input: {
      name?: string;
      ansprechperson?: string | null;
      notiz?: string | null;
      standorte?: StandortEingabe[];
      konfiguration?: KonfigurationEingabe;
    },
  ): Promise<LeadDetail> {
    const bisher = await this.laden(id);
    const data: Prisma.LeadUpdateInput = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.ansprechperson !== undefined) data.ansprechperson = leer(input.ansprechperson);
    if (input.notiz !== undefined) data.notiz = leer(input.notiz);
    if (input.konfiguration) {
      const neu = bereinigeKonfiguration(input.konfiguration, konfiguration(bisher));
      data.anzahlHaeuser = neu.haeuser;
      data.anzahlNutzer = neu.nutzer;
      data.keyUser = neu.keyUser;
      data.tier = neu.tier;
      data.module = neu.module;
    }

    if (input.standorte) {
      await this.prisma.$transaction([
        this.prisma.leadStandort.deleteMany({ where: { leadId: id } }),
        this.prisma.lead.update({
          where: { id },
          data: { ...data, standorte: { create: standortDaten(input.standorte) } },
        }),
      ]);
    } else {
      await this.prisma.lead.update({ where: { id }, data });
    }

    await this.audit.log({
      actor,
      action: "lead.update",
      entityType: "lead",
      entityId: id,
      detail: `Interessent "${bisher.name}" geändert`,
    });
    return this.get(id);
  }

  async setStatus(actor: RequestUser, id: string, status: LeadStatusKey): Promise<LeadDetail> {
    const lead = await this.laden(id);
    await this.prisma.lead.update({ where: { id }, data: { status } });
    await this.audit.log({
      actor,
      action: "lead.status",
      entityType: "lead",
      entityId: id,
      detail: `Interessent "${lead.name}": Status ${lead.status} → ${status}`,
    });
    return this.get(id);
  }

  /** Neuer Link. Der alte hört damit auf zu gelten. */
  async neuerLink(actor: RequestUser, id: string, tage?: number) {
    const lead = await this.laden(id);
    const token = neuesToken();
    await this.prisma.lead.update({
      where: { id },
      data: {
        tokenHash: hashToken(token),
        tokenGueltigBis: linkGueltigBis(tage ?? LINK_TAGE_STANDARD),
        tokenWiderrufenAm: null,
      },
    });
    await this.audit.log({
      actor,
      action: "lead.link",
      entityType: "lead",
      entityId: id,
      detail: `Neuer Link für "${lead.name}" erzeugt, der bisherige ist ungültig`,
    });
    return { lead: await this.get(id), token };
  }

  async widerrufen(actor: RequestUser, id: string): Promise<LeadDetail> {
    const lead = await this.laden(id);
    await this.prisma.lead.update({ where: { id }, data: { tokenWiderrufenAm: new Date() } });
    await this.audit.log({
      actor,
      action: "lead.revoke",
      entityType: "lead",
      entityId: id,
      detail: `Link für "${lead.name}" widerrufen`,
    });
    return this.get(id);
  }

  async remove(actor: RequestUser, id: string): Promise<void> {
    const lead = await this.laden(id);
    await this.prisma.lead.delete({ where: { id } });
    await this.audit.log({
      actor,
      action: "lead.delete",
      entityType: "lead",
      entityId: id,
      detail: `Interessent "${lead.name}" gelöscht`,
    });
  }

  /* ------------------------------------------------- Haus anlegen */

  /** Was aus dem Interessenten würde, ohne etwas anzulegen. */
  async hausVorschau(id: string): Promise<HausVorschau> {
    const lead = await this.laden(id);
    return this.plane(lead);
  }

  /**
   * Legt aus dem Interessenten das Haus an: Standorte, Marken, Abteilungen,
   * Module und Lizenzkontingent kommen aus seinen Angaben und seiner Auswahl.
   *
   * Dasselbe Anlegen wie in der Mandantenverwaltung (eine Transaktion, Rollen
   * und erstes Konto inklusive) - nur mit einer Vorlage statt des leeren
   * Startpunkts. Ein Interessent wird höchstens einmal zum Haus.
   */
  async hausAnlegen(
    actor: RequestUser,
    id: string,
    input: {
      slug: string;
      domain?: string;
      adminUsername: string;
      adminPassword: string;
      adminFirstName?: string;
      adminLastName?: string;
      adminEmail?: string;
    },
  ) {
    const lead = await this.laden(id);
    if (lead.hausId) {
      throw new BadRequestException("Aus diesem Interessenten wurde bereits ein Haus angelegt.");
    }
    if (lead.standorte.length === 0) {
      throw new BadRequestException("Ohne Häuser lässt sich kein Mandant anlegen. Bitte zuerst Häuser erfassen.");
    }

    const vorschau = this.plane(lead);
    const tenant = await this.tenants.create({
      slug: input.slug,
      name: lead.name,
      domain: input.domain,
      notes: `Aus Interessent ${lead.id}${lead.preislisteVersion ? ` (Preisliste ${lead.preislisteVersion})` : ""}`,
      adminUsername: input.adminUsername,
      adminPassword: input.adminPassword,
      adminFirstName: input.adminFirstName,
      adminLastName: input.adminLastName,
      adminEmail: input.adminEmail,
      licensedSeats: vorschau.lizenzen,
      // Häuser kosten nur Einrichtung, keine Gebühr: eine Obergrenze wäre erfunden.
      locationLimit: null,
      vorlage: { plan: vorschau.plan, module: vorschau.moduleZustand },
    });

    await this.prisma.lead.update({ where: { id }, data: { hausId: tenant.id, status: "gewonnen" } });

    await this.audit.log({
      actor,
      action: "lead.haus",
      entityType: "lead",
      entityId: id,
      detail: `Haus "${tenant.name}" (${tenant.slug}) aus Interessent angelegt: ${vorschau.plan.standorte.length} Standorte, ${vorschau.lizenzen} Lizenzen`,
    });
    await this.audit.log({
      actor,
      action: "tenant.create",
      entityType: "tenant",
      entityId: tenant.id,
      detail: `Mandant "${tenant.name}" (${tenant.slug}) aus Interessent angelegt`,
    });

    return { tenantId: tenant.id, slug: tenant.slug, name: tenant.name };
  }

  private plane(lead: LeadMitStandorten): HausVorschau {
    const konf = konfiguration(lead);
    const angebot = rechne(konf);
    const plan = planeHaus(lead.standorte);
    const moduleZustand = modulEinstellungen(angebot.module);
    return {
      bereitsAngelegt: lead.hausId !== null,
      hausId: lead.hausId,
      kennung: vorschlagKennung(lead.name),
      lizenzen: konf.nutzer,
      plan,
      moduleZustand,
      modulAn: moduleZustand.filter((modul) => modul.enabled).map((modul) => modul.key),
      modulErprobung: konf.tier === "komplett" ? betaKeys() : [],
    };
  }

  /* ---------------------------------------------- Pitch-Seite (öffentlich) */

  async ansicht(token: string): Promise<PitchAnsicht> {
    const lead = await this.perToken(token);
    const angaben = lead.standorte.map((standort) => ({
      name: standort.name,
      marken: standort.marken,
      leistungen: standort.leistungen,
      oeffnungszeiten: standort.oeffnungszeiten,
      campus: standort.campus,
    }));

    return {
      name: lead.name,
      gueltigBis: lead.tokenGueltigBis.toISOString(),
      angefragt: lead.angefragtAm !== null,
      konfiguration: konfiguration(lead),
      standorte: lead.standorte.map((standort, index) => {
        const regel = vorschlagFuerStandort(angaben[index], angaben);
        const adresse = [standort.strasse, [standort.plz, standort.ort].filter(Boolean).join(" ")]
          .filter(Boolean)
          .join(", ");
        return {
          name: standort.name,
          adresse: adresse || null,
          marken: standort.marken,
          leistungen: standort.leistungen,
          oeffnungszeiten: standort.oeffnungszeiten,
          campus: standort.campus,
          // Ein von Hand geschriebener Text ersetzt den Regeltext, nicht die Modulauswahl.
          vorschlagText: standort.vorschlag ?? regel.text,
          vorschlagModule: regel.module,
        };
      }),
    };
  }

  /** Der Interessent stellt Häuser, Nutzer und Module ein. Schreibt nur diese Felder. */
  async speichern(
    token: string,
    eingabe: KonfigurationEingabe,
  ): Promise<{ konfiguration: LeadKonfiguration; angebot: Angebot }> {
    const lead = await this.perToken(token);
    const neu = bereinigeKonfiguration(eingabe, konfiguration(lead));
    await this.prisma.lead.update({
      where: { id: lead.id },
      data: {
        anzahlHaeuser: neu.haeuser,
        anzahlNutzer: neu.nutzer,
        keyUser: neu.keyUser,
        tier: neu.tier,
        module: neu.module,
      },
    });
    return { konfiguration: neu, angebot: rechne(neu) };
  }

  /**
   * Der Interessent schickt seine Auswahl ab.
   *
   * Festgehalten wird das Angebot, wie es der Server rechnet, samt Version der
   * Preisliste - nicht, was der Browser angezeigt hat. Der Betreiber sieht
   * damit, wozu der Interessent sich geäußert hat, auch wenn sich die Preise
   * später ändern.
   */
  async anfragen(token: string, eingabe: KonfigurationEingabe) {
    const lead = await this.perToken(token);
    const neu = bereinigeKonfiguration(eingabe, konfiguration(lead));
    const angebot = rechne(neu);

    await this.prisma.lead.update({
      where: { id: lead.id },
      data: {
        anzahlHaeuser: neu.haeuser,
        anzahlNutzer: neu.nutzer,
        keyUser: neu.keyUser,
        tier: neu.tier,
        module: neu.module,
        status: "angefragt",
        angefragtAm: new Date(),
        angebot: angebot as unknown as Prisma.InputJsonValue,
        preislisteVersion: PREISLISTE_VERSION,
      },
    });

    await this.audit.log({
      actor: { username: "pitch-link" },
      action: "lead.anfrage",
      entityType: "lead",
      entityId: lead.id,
      detail: `Anfrage von "${lead.name}": ${angebot.modus === "tier" ? `Tier ${angebot.tier}` : "Einzelwahl"}, ${angebot.nutzer} Nutzer, ${formatEuro(angebot.monatlich.summeCent)} je Monat`,
    });

    const betreiber = await this.prisma.user.findMany({
      where: { isPlatformAdmin: true, status: "active" },
      select: { id: true },
    });
    await this.notifications.notify({
      userIds: betreiber.map((konto) => konto.id),
      title: `Anfrage von ${lead.name}`,
      detail: `${angebot.nutzer} Nutzer, ${angebot.haeuser} Häuser, ${formatEuro(angebot.monatlich.summeCent)} je Monat`,
      link: `/plattform/interessenten/${lead.id}`,
      auchPerMail: true,
    });

    return { konfiguration: neu, angebot };
  }

  /* ----------------------------------------------------------- intern */

  private async laden(id: string): Promise<LeadMitStandorten> {
    const lead = await this.prisma.lead.findFirst({
      where: { id },
      include: { standorte: { orderBy: { position: "asc" } } },
    });
    if (!lead) {
      throw new NotFoundException("Interessent nicht gefunden");
    }
    return lead;
  }

  /**
   * Findet den Interessenten zu einem Link.
   *
   * Jeder Fehlschlag antwortet gleich: ein abgelaufener, widerrufener oder nie
   * vergebener Link sollen von außen nicht zu unterscheiden sein. Ohne
   * Mandantenkontext (die Adresse gehört zu keinem Haus) gilt dasselbe - die
   * Seite verrät nicht, ob es hier überhaupt Interessenten gibt.
   */
  private async perToken(token: string): Promise<LeadMitStandorten> {
    const unbekannt = new NotFoundException("Dieser Link ist nicht mehr gültig.");
    if (!currentTenant() || !token || token.length < 20 || token.length > 100) {
      throw unbekannt;
    }

    const lead = await this.prisma.lead.findFirst({
      where: { tokenHash: hashToken(token) },
      include: { standorte: { orderBy: { position: "asc" } } },
    });
    if (!lead || !linkIstGueltig(lead)) {
      throw unbekannt;
    }
    return lead;
  }

  private async detail(lead: LeadMitStandorten): Promise<LeadDetail> {
    const konf = konfiguration(lead);
    return {
      ...summary(lead),
      hausId: lead.hausId,
      ansprechperson: lead.ansprechperson,
      notiz: lead.notiz,
      standortListe: lead.standorte.map(standortItem),
      angebot: (lead.angebot as unknown as Angebot | null) ?? null,
      preislisteVersion: lead.preislisteVersion,
      angebotHeute: rechne(konf),
    };
  }
}

export type { TierKey };
