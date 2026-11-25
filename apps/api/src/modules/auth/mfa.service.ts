import { BadRequestException, Injectable } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { AuditService } from "../../core/audit.service";
import { entschluessele, istVerschluesselungMoeglich, verschluessele } from "../../core/geheimnis";
import { PrismaService } from "../../core/prisma.service";
import type { RequestUser } from "../../core/request-user";
import {
  hashWiederherstellungscode,
  neueWiederherstellungscodes,
  neuesTotpGeheimnis,
  pruefeTotp,
  totpAdresse,
} from "../../core/totp";

/** Was die Prüfung eines zweiten Faktors vom Konto braucht. */
export interface MfaKonto {
  id: string;
  totpSecret: string | null;
  totpLastStep: number | null;
  totpRecoveryHashes: string[];
}

/** Sieht aus wie ein Wiederherstellungscode (`abcd-efgh`), nicht wie ein sechsstelliger Code. */
const WIEDERHERSTELLUNGSCODE = /^[a-z0-9]{4}-?[a-z0-9]{4}$/i;

/**
 * Zweiter Faktor per Authenticator-App (TOTP) mit Wiederherstellungscodes.
 *
 * Bewusst nur dieser eine Weg: er läuft auf jedem Telefon ohne Netz, ohne
 * Mobilfunkvertrag des Hauses und ohne Dienst eines Dritten. SMS entfiele hier
 * schon deshalb, weil sie selbst als Faktor gilt, den man umleiten kann.
 */
@Injectable()
export class MfaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Pflicht ergibt sich aus dem Haus oder daraus, dass das Konto die Plattform verwaltet. */
  async istPflicht(userId: string): Promise<boolean> {
    const konto = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { isPlatformAdmin: true, tenant: { select: { mfaPflicht: true } } },
    });
    return konto.isPlatformAdmin || konto.tenant.mfaPflicht;
  }

  /**
   * Beginnt die Einrichtung: erzeugt ein Geheimnis und legt es verschlüsselt ab,
   * wirksam wird es aber erst mit dem ersten bestätigten Code. Ein
   * Abbruch dazwischen sperrt niemanden aus.
   */
  async einrichten(current: RequestUser): Promise<{ geheimnis: string; adresse: string }> {
    if (!istVerschluesselungMoeglich()) {
      // Lieber eine klare Absage als ein Geheimnis im Klartext.
      throw new BadRequestException(
        "SECRET_KEY ist nicht gesetzt - der zweite Faktor kann nicht sicher gespeichert werden. Bitte die IT verständigen.",
      );
    }
    const konto = await this.prisma.user.findUniqueOrThrow({
      where: { id: current.id },
      select: { username: true, totpEnabledAt: true, tenant: { select: { name: true } } },
    });
    if (konto.totpEnabledAt) {
      throw new BadRequestException("Der zweite Faktor ist bereits eingerichtet.");
    }

    const geheimnis = neuesTotpGeheimnis();
    await this.prisma.user.update({
      where: { id: current.id },
      data: { totpSecret: verschluessele(geheimnis), totpEnabledAt: null, totpLastStep: null },
    });
    return { geheimnis, adresse: totpAdresse(geheimnis, konto.username, `AHOI ${konto.tenant.name}`) };
  }

  /**
   * Schließt die Einrichtung mit dem ersten Code ab und gibt die
   * Wiederherstellungscodes heraus - zum einzigen Mal im Klartext.
   *
   * Alle bisherigen Sitzungen enden (`tokenVersion`): wer den Faktor einrichtet,
   * soll danach nicht mit Sitzungen weiterarbeiten, die ihn nie gesehen haben.
   */
  async bestaetigen(current: RequestUser, code: string): Promise<{ wiederherstellungscodes: string[] }> {
    const konto = await this.prisma.user.findUniqueOrThrow({ where: { id: current.id } });
    if (konto.totpEnabledAt || !konto.totpSecret) {
      throw new BadRequestException("Es läuft keine Einrichtung. Bitte von vorn beginnen.");
    }
    const schritt = pruefeTotp(entschluessele(konto.totpSecret), code);
    if (schritt === null) {
      throw new BadRequestException("Der Code stimmt nicht. Bitte den aktuellen Code der App eingeben.");
    }

    const codes = neueWiederherstellungscodes();
    await this.prisma.user.update({
      where: { id: current.id },
      data: {
        totpEnabledAt: new Date(),
        totpLastStep: schritt,
        totpRecoveryHashes: codes.map(hashWiederherstellungscode),
        tokenVersion: { increment: 1 },
      },
    });
    await this.audit.log({
      actor: current,
      action: "auth.mfa_enabled",
      entityType: "user",
      entityId: current.id,
      detail: "Zweiter Faktor eingerichtet",
    });
    return { wiederherstellungscodes: codes };
  }

  /**
   * Prüft Code oder Wiederherstellungscode und verbraucht ihn.
   *
   * Der Zeitschritt wird atomar fortgeschrieben: zwei gleichzeitige Anfragen mit
   * demselben Code kämen sonst beide durch.
   */
  async pruefe(konto: MfaKonto, eingabe: string): Promise<boolean> {
    if (!konto.totpSecret) {
      return false;
    }
    const text = eingabe.trim();

    if (WIEDERHERSTELLUNGSCODE.test(text)) {
      const hash = hashWiederherstellungscode(text);
      if (!konto.totpRecoveryHashes.includes(hash)) {
        return false;
      }
      const verbraucht = await this.prisma.user.updateMany({
        where: { id: konto.id, totpRecoveryHashes: { has: hash } },
        data: { totpRecoveryHashes: konto.totpRecoveryHashes.filter((eintrag) => eintrag !== hash) },
      });
      if (verbraucht.count !== 1) {
        return false;
      }
      await this.audit.log({
        actor: { id: konto.id, username: konto.id },
        action: "auth.mfa_recovery_used",
        entityType: "user",
        entityId: konto.id,
        detail: `Wiederherstellungscode verwendet, ${konto.totpRecoveryHashes.length - 1} übrig`,
      });
      return true;
    }

    const schritt = pruefeTotp(entschluessele(konto.totpSecret), text, konto.totpLastStep);
    if (schritt === null) {
      return false;
    }
    const fortgeschrieben = await this.prisma.user.updateMany({
      where: { id: konto.id, OR: [{ totpLastStep: null }, { totpLastStep: { lt: schritt } }] },
      data: { totpLastStep: schritt },
    });
    return fortgeschrieben.count === 1;
  }

  /** Schaltet den Faktor ab - nur, wo er nicht vorgeschrieben ist, und nur mit Passwort und Code. */
  async deaktivieren(current: RequestUser, passwort: string, code: string): Promise<void> {
    const konto = await this.bestaetigteIdentitaet(current, passwort, code);
    if (await this.istPflicht(konto.id)) {
      throw new BadRequestException(
        "In diesem Haus ist der zweite Faktor vorgeschrieben und lässt sich nicht abschalten.",
      );
    }
    await this.prisma.user.update({
      where: { id: current.id },
      data: {
        totpSecret: null,
        totpEnabledAt: null,
        totpLastStep: null,
        totpRecoveryHashes: [],
        tokenVersion: { increment: 1 },
      },
    });
    await this.audit.log({
      actor: current,
      action: "auth.mfa_disabled",
      entityType: "user",
      entityId: current.id,
      detail: "Zweiter Faktor abgeschaltet",
    });
  }

  /** Ersetzt alle Wiederherstellungscodes durch neue; die alten verfallen. */
  async neueCodes(
    current: RequestUser,
    passwort: string,
    code: string,
  ): Promise<{ wiederherstellungscodes: string[] }> {
    await this.bestaetigteIdentitaet(current, passwort, code);
    const codes = neueWiederherstellungscodes();
    await this.prisma.user.update({
      where: { id: current.id },
      data: { totpRecoveryHashes: codes.map(hashWiederherstellungscode) },
    });
    await this.audit.log({
      actor: current,
      action: "auth.mfa_recovery_renewed",
      entityType: "user",
      entityId: current.id,
      detail: "Wiederherstellungscodes erneuert",
    });
    return { wiederherstellungscodes: codes };
  }

  /**
   * Setzt den Faktor eines Kontos zurück, etwa wenn das Telefon verloren ist
   * und die Wiederherstellungscodes fehlen. Die Person richtet ihn beim
   * nächsten Anmelden neu ein - ist er Pflicht, sofort.
   */
  async zuruecksetzen(actor: RequestUser, userId: string): Promise<{ ok: true }> {
    const ziel = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, username: true } });
    if (!ziel) {
      throw new BadRequestException("Das Konto gibt es nicht.");
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        totpSecret: null,
        totpEnabledAt: null,
        totpLastStep: null,
        totpRecoveryHashes: [],
        tokenVersion: { increment: 1 },
      },
    });
    await this.audit.log({
      actor,
      action: "auth.mfa_reset",
      entityType: "user",
      entityId: userId,
      detail: `Zweiter Faktor von ${ziel.username} zurückgesetzt`,
    });
    return { ok: true };
  }

  /** Sensible Änderungen am eigenen Faktor verlangen beides: wer das Passwort kennt, ist noch nicht die Person. */
  private async bestaetigteIdentitaet(current: RequestUser, passwort: string, code: string) {
    const konto = await this.prisma.user.findUniqueOrThrow({ where: { id: current.id } });
    if (!konto.totpEnabledAt) {
      throw new BadRequestException("Der zweite Faktor ist nicht eingerichtet.");
    }
    if (!konto.passwordHash || !(await bcrypt.compare(passwort, konto.passwordHash))) {
      throw new BadRequestException("Das Passwort ist nicht korrekt.");
    }
    if (!(await this.pruefe(konto, code))) {
      throw new BadRequestException("Der Code stimmt nicht.");
    }
    return konto;
  }
}
