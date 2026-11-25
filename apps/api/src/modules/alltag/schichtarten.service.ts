import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { ArbeitszeitProfil, SchichtartItem } from "@ah-intranet/shared";
import { PrismaService } from "../../core/prisma.service";
import { AuditService } from "../../core/audit.service";
import { displayName } from "../../core/mappers";
import type { RequestUser } from "../../core/request-user";
import { parseZeit, pruefeSchichtart } from "./schichtplanung";

export interface SchichtartInput {
  name: string;
  startZeit: string;
  endZeit: string;
  pauseMinuten?: number;
  mindestBesetzung: number;
  idealBesetzung: number;
  tage: number[];
  beiSondertag?: boolean;
  aktiv?: boolean;
  locationId?: string | null;
  departmentId?: string | null;
  teamLeadId?: string | null;
}

export interface ProfilInput {
  wochenstunden?: number | null;
  zeitfensterVon?: string | null;
  zeitfensterBis?: string | null;
  arbeitstage?: number[];
}

const artInclude = {
  location: { select: { name: true } },
  department: { select: { name: true } },
  teamLead: { select: { firstName: true, lastName: true } },
} as const;

/**
 * Schichtarten und Arbeitszeitprofile.
 *
 * Eine Schichtart ist die Vorlage („Frühschicht 8-15 Uhr, mindestens 2, ideal
 * 3"), aus der die Autoplanung Schichten macht. Das Profil sagt je Person, wann
 * sie überhaupt eingeplant werden kann. Beides sind Arbeitszeitdaten und
 * mitbestimmungspflichtig (§ 87 Abs. 1 Nr. 2 BetrVG) - siehe docs/recht.md.
 */
@Injectable()
export class SchichtartenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /* ------------------------------------------------------- Schichtarten */

  async list(): Promise<SchichtartItem[]> {
    const rows = await this.prisma.schichtart.findMany({
      include: artInclude,
      orderBy: [{ aktiv: "desc" }, { name: "asc" }],
    });
    return rows.map((row) => this.toItem(row));
  }

  async create(actor: RequestUser, input: SchichtartInput): Promise<SchichtartItem> {
    const daten = await this.pruefe(input);
    const row = await this.prisma.schichtart.create({ data: daten, include: artInclude });
    await this.audit.log({
      actor,
      action: "schichtart.create",
      entityType: "schichtart",
      entityId: row.id,
      detail: `Schichtart "${row.name}" (${row.startZeit}-${row.endZeit}, mindestens ${row.mindestBesetzung}, ideal ${row.idealBesetzung}) angelegt`,
    });
    return this.toItem(row);
  }

  async update(actor: RequestUser, id: string, input: SchichtartInput): Promise<SchichtartItem> {
    if (!(await this.prisma.schichtart.findUnique({ where: { id }, select: { id: true } }))) {
      throw new NotFoundException("Schichtart nicht gefunden");
    }
    const daten = await this.pruefe(input);
    const row = await this.prisma.schichtart.update({ where: { id }, data: daten, include: artInclude });
    await this.audit.log({
      actor,
      action: "schichtart.update",
      entityType: "schichtart",
      entityId: id,
      detail: `Schichtart "${row.name}" geändert`,
    });
    return this.toItem(row);
  }

  /** Löscht die Vorlage; bereits geplante Schichten bleiben, nur ihr Verweis entfällt. */
  async remove(actor: RequestUser, id: string): Promise<void> {
    const vorhanden = await this.prisma.schichtart.findUnique({ where: { id } });
    if (!vorhanden) {
      throw new NotFoundException("Schichtart nicht gefunden");
    }
    await this.prisma.schichtart.delete({ where: { id } });
    await this.audit.log({
      actor,
      action: "schichtart.delete",
      entityType: "schichtart",
      entityId: id,
      detail: `Schichtart "${vorhanden.name}" gelöscht`,
    });
  }

  /* -------------------------------------------------- Arbeitszeitprofile */

  async profile(): Promise<ArbeitszeitProfil[]> {
    const rows = await this.prisma.user.findMany({
      where: { status: "active" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        loginEnabled: true,
        wochenstunden: true,
        zeitfensterVon: true,
        zeitfensterBis: true,
        arbeitstage: true,
        location: { select: { name: true } },
        department: { select: { name: true } },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
    return rows.map((row) => ({
      id: row.id,
      displayName: displayName(row),
      hasAccess: row.loginEnabled,
      location: row.location?.name ?? null,
      department: row.department?.name ?? null,
      wochenstunden: row.wochenstunden,
      zeitfensterVon: row.zeitfensterVon,
      zeitfensterBis: row.zeitfensterBis,
      arbeitstage: [...row.arbeitstage].sort(),
    }));
  }

  async setzeProfil(actor: RequestUser, userId: string, input: ProfilInput): Promise<ArbeitszeitProfil[]> {
    const person = await this.prisma.user.findFirst({
      where: { id: userId, status: "active" },
      select: { id: true, firstName: true, lastName: true, zeitfensterVon: true, zeitfensterBis: true },
    });
    if (!person) {
      throw new NotFoundException("Person nicht gefunden");
    }

    const data: Record<string, unknown> = {};
    if (input.wochenstunden !== undefined) {
      if (
        input.wochenstunden !== null &&
        (!Number.isFinite(input.wochenstunden) || input.wochenstunden < 0 || input.wochenstunden > 60)
      ) {
        throw new BadRequestException("Die Wochenarbeitszeit liegt zwischen 0 und 60 Stunden.");
      }
      data.wochenstunden = input.wochenstunden;
    }

    if (input.zeitfensterVon !== undefined || input.zeitfensterBis !== undefined) {
      const von = input.zeitfensterVon === undefined ? person.zeitfensterVon : input.zeitfensterVon;
      const bis = input.zeitfensterBis === undefined ? person.zeitfensterBis : input.zeitfensterBis;
      if ((von === null) !== (bis === null)) {
        throw new BadRequestException("Ein Zeitfenster braucht Beginn und Ende - oder keins von beiden.");
      }
      if (von !== null && bis !== null) {
        const vonMinuten = parseZeit(von);
        const bisMinuten = parseZeit(bis);
        if (vonMinuten === null || bisMinuten === null) {
          throw new BadRequestException("Bitte Uhrzeiten im Format HH:MM angeben.");
        }
        if (bisMinuten <= vonMinuten) {
          throw new BadRequestException("Das Zeitfenster muss am selben Tag enden, an dem es beginnt.");
        }
      }
      data.zeitfensterVon = von;
      data.zeitfensterBis = bis;
    }

    if (input.arbeitstage !== undefined) {
      const tage = [...new Set(input.arbeitstage)].sort();
      if (tage.some((tag) => !Number.isInteger(tag) || tag < 1 || tag > 7)) {
        throw new BadRequestException("Arbeitstage sind Wochentage von 1 (Montag) bis 7 (Sonntag).");
      }
      data.arbeitstage = tage;
    }

    await this.prisma.user.update({ where: { id: userId }, data });
    await this.audit.log({
      actor,
      action: "arbeitszeit.update",
      entityType: "user",
      entityId: userId,
      detail: `Arbeitszeitprofil von ${displayName(person)} geändert`,
    });
    return this.profile();
  }

  /* ----------------------------------------------------------- Helfer */

  private async pruefe(input: SchichtartInput) {
    const name = input.name.trim();
    if (name.length < 2 || name.length > 60) {
      throw new BadRequestException("Der Name braucht 2 bis 60 Zeichen.");
    }
    if (parseZeit(input.startZeit) === null || parseZeit(input.endZeit) === null) {
      throw new BadRequestException("Bitte Beginn und Ende als Uhrzeit angeben (HH:MM).");
    }
    if (input.startZeit === input.endZeit) {
      throw new BadRequestException("Beginn und Ende dürfen nicht gleich sein.");
    }
    const pause = input.pauseMinuten ?? 0;
    if (!Number.isInteger(pause) || pause < 0 || pause > 240) {
      throw new BadRequestException("Die Pause liegt zwischen 0 und 240 Minuten.");
    }
    for (const [feld, wert] of [
      ["Mindestbesetzung", input.mindestBesetzung],
      ["Idealbesetzung", input.idealBesetzung],
    ] as const) {
      if (!Number.isInteger(wert) || wert < 1 || wert > 99) {
        throw new BadRequestException(`${feld} ist eine Pflichtangabe zwischen 1 und 99.`);
      }
    }
    if (input.idealBesetzung < input.mindestBesetzung) {
      throw new BadRequestException("Die Idealbesetzung darf nicht unter der Mindestbesetzung liegen.");
    }
    const tage = [...new Set(input.tage)].sort();
    if (tage.length === 0 || tage.some((tag) => !Number.isInteger(tag) || tag < 1 || tag > 7)) {
      throw new BadRequestException("Bitte mindestens einen Wochentag wählen.");
    }

    // Fremde Kennungen scheitern schon am Mandantenfilter; hier kommt die verständliche Meldung.
    const locationId = input.locationId || null;
    const departmentId = input.departmentId || null;
    const teamLeadId = input.teamLeadId || null;
    if (locationId && !(await this.prisma.location.findFirst({ where: { id: locationId }, select: { id: true } }))) {
      throw new BadRequestException("Der Standort existiert in diesem Haus nicht.");
    }
    if (
      departmentId &&
      !(await this.prisma.department.findFirst({ where: { id: departmentId }, select: { id: true } }))
    ) {
      throw new BadRequestException("Die Abteilung existiert in diesem Haus nicht.");
    }
    if (
      teamLeadId &&
      !(await this.prisma.user.findFirst({ where: { id: teamLeadId, status: "active" }, select: { id: true } }))
    ) {
      throw new BadRequestException("Die Führungskraft des Teams existiert in diesem Haus nicht.");
    }

    return {
      name,
      startZeit: input.startZeit,
      endZeit: input.endZeit,
      pauseMinuten: pause,
      mindestBesetzung: input.mindestBesetzung,
      idealBesetzung: input.idealBesetzung,
      tage,
      beiSondertag: input.beiSondertag ?? false,
      aktiv: input.aktiv ?? true,
      locationId,
      departmentId,
      teamLeadId,
    };
  }

  private toItem(row: {
    id: string;
    name: string;
    startZeit: string;
    endZeit: string;
    pauseMinuten: number;
    mindestBesetzung: number;
    idealBesetzung: number;
    tage: number[];
    beiSondertag: boolean;
    aktiv: boolean;
    locationId: string | null;
    departmentId: string | null;
    teamLeadId: string | null;
    location: { name: string } | null;
    department: { name: string } | null;
    teamLead: { firstName: string; lastName: string } | null;
  }): SchichtartItem {
    const bereich = [
      row.location?.name,
      row.department?.name,
      row.teamLead ? `Team ${displayName(row.teamLead)}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    return {
      id: row.id,
      name: row.name,
      startZeit: row.startZeit,
      endZeit: row.endZeit,
      pauseMinuten: row.pauseMinuten,
      mindestBesetzung: row.mindestBesetzung,
      idealBesetzung: row.idealBesetzung,
      tage: [...row.tage].sort(),
      beiSondertag: row.beiSondertag,
      aktiv: row.aktiv,
      locationId: row.locationId,
      departmentId: row.departmentId,
      teamLeadId: row.teamLeadId,
      bereich: bereich || "Ganzes Haus",
      befunde: pruefeSchichtart(row),
    };
  }
}
