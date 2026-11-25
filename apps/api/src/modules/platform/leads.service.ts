import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type Lead, type LeadStandort } from "../../generated/prisma/client";
import {
  PREISLISTE_VERSION,
  bereinigeKonfiguration,
  type KonfigurationEingabe,
  berechneAngebot,
  bereinigeKundenStandorte,
  formatEuro,
  isTierKey,
  vorschlagFuerStandort,
  type Angebot,
  type LeadDetail,
  type LeadKonfiguration,
  type LeadStandortItem,
  type LeadStatusKey,
  type LeadSummary,
  type PitchAnsicht,
  type PitchStandort,
  type PitchStandortEingabe,
  type TierKey,
} from "@ah-intranet/shared";
import { AuditService } from "../../core/audit.service";
import { NotificationsService } from "../../core/notifications.service";
import { PrismaService } from "../../core/prisma.service";
import { currentTenant } from "../../core/tenant-context";
import { hashToken, linkIstGueltig } from "./pitch-regeln";

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

/** Die Häuser des Betreibers in der Form, in der der Interessent sie verändern darf. */
function alsEingabe(lead: LeadMitStandorten): PitchStandortEingabe[] {
  return lead.standorte.map((standort) => ({
    name: standort.name,
    adresse:
      [standort.strasse, [standort.plz, standort.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ") || null,
    marken: standort.marken,
    leistungen: standort.leistungen,
    oeffnungszeiten: standort.oeffnungszeiten,
    campus: standort.campus,
  }));
}

/** Die vom Interessenten veränderten Häuser. Aus der Datenbank gelesen heißt: noch einmal bereinigt. */
function kundenStandorte(lead: Lead): PitchStandortEingabe[] | null {
  if (!Array.isArray(lead.kundenStandorte)) return null;
  const liste = bereinigeKundenStandorte(lead.kundenStandorte as unknown as PitchStandortEingabe[]);
  return liste.length > 0 ? liste : null;
}

/** Häuser samt Vorschlag aus den Regeln. Ein Text von Hand gilt nur, wo der Betreiber einen geschrieben hat. */
function zuPitchStandorten(liste: readonly (PitchStandortEingabe & { vorschlag?: string | null })[]): PitchStandort[] {
  const angaben = liste.map((haus) => ({
    name: haus.name,
    marken: haus.marken,
    leistungen: haus.leistungen,
    oeffnungszeiten: haus.oeffnungszeiten,
    campus: haus.campus,
  }));
  return liste.map((haus, index) => {
    const regel = vorschlagFuerStandort(angaben[index], angaben);
    return {
      name: haus.name,
      adresse: haus.adresse,
      marken: haus.marken,
      leistungen: haus.leistungen,
      oeffnungszeiten: haus.oeffnungszeiten,
      campus: haus.campus,
      vorschlagText: haus.vorschlag ?? regel.text,
      vorschlagModule: regel.module,
      vorschlagVonHand: Boolean(haus.vorschlag),
    };
  });
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

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /* ---------------------------------------------- Pitch-Seite (öffentlich) */

  async ansicht(token: string): Promise<PitchAnsicht> {
    const lead = await this.perToken(token);
    const ausgang = zuPitchStandorten(
      alsEingabe(lead).map((haus, index) => ({ ...haus, vorschlag: lead.standorte[index].vorschlag })),
    );
    const veraendert = kundenStandorte(lead);

    return {
      name: lead.name,
      gueltigBis: lead.tokenGueltigBis.toISOString(),
      angefragt: lead.angefragtAm !== null,
      konfiguration: konfiguration(lead),
      standorte: veraendert ? zuPitchStandorten(veraendert) : ausgang,
      ausgang,
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
        ...this.hauserDaten(lead, eingabe),
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
        ...this.hauserDaten(lead, eingabe),
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

  /**
   * Die Häuser des Interessenten fürs Speichern.
   *
   * Nichts schicken heißt: nichts ändern. Sind die Häuser so, wie der Betreiber sie
   * erfasst hat, wird die Abweichung gelöscht, damit "verändert" auch verändert
   * heißt. Eine leere Liste lehnt die Seite ab, ein Mandant ohne Haus wäre wertlos.
   */
  private hauserDaten(
    lead: LeadMitStandorten,
    eingabe: KonfigurationEingabe,
  ): { kundenStandorte?: Prisma.InputJsonValue | typeof Prisma.DbNull } {
    if (eingabe.standorte === undefined) return {};
    const bereinigt = bereinigeKundenStandorte(eingabe.standorte);
    if (bereinigt.length === 0) return {};
    const ausgang = alsEingabe(lead);
    const gleich = JSON.stringify(bereinigt) === JSON.stringify(bereinigeKundenStandorte(ausgang));
    return { kundenStandorte: gleich ? Prisma.DbNull : (bereinigt as unknown as Prisma.InputJsonValue) };
  }

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
      kundenStandorte: (kundenStandorte(lead) ?? []).length
        ? kundenStandorte(lead)!.map((haus) => ({
            name: haus.name,
            strasse: haus.adresse,
            plz: null,
            ort: null,
            marken: haus.marken,
            leistungen: haus.leistungen,
            oeffnungszeiten: haus.oeffnungszeiten,
            campus: haus.campus,
            vorschlag: null,
          }))
        : null,
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
