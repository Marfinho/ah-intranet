import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { DatenbankService } from "../../core/datenbank";
import { entschluessele, istVerschluesselungMoeglich, verschluessele } from "../../core/geheimnis";
import { ProtokollService } from "../../core/protokoll.service";
import {
  hashWiederherstellungscode,
  neueWiederherstellungscodes,
  neuesTotpGeheimnis,
  pruefeTotp,
  totpAdresse,
} from "../../core/totp";

/** Ab so vielen Fehlversuchen in Folge ist das Konto kurz gesperrt. */
const MAX_FEHLVERSUCHE = 5;
const SPERRE_MINUTEN = 15;

export interface SitzungsToken {
  sub: string;
  tokenVersion: number;
  /** Der zweite Faktor ist Pflicht; `true`, solange er noch nicht eingerichtet ist. */
  mfaOffen: boolean;
}

/** Ein Hash, gegen den auch bei unbekanntem Konto verglichen wird: gleiche Antwortzeit. */
const ATTRAPPE = bcrypt.hashSync("attrappe-ohne-bedeutung", 12);

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatenbankService,
    private readonly jwt: JwtService,
    private readonly protokoll: ProtokollService,
  ) {}

  /**
   * Schritt 1: Passwort. Der Fehlversuchszähler wird erst mit dem Code
   * zurückgesetzt - sonst ließen sich Codes mit bekanntem Passwort unbegrenzt raten.
   */
  async anmelden(username: string, passwort: string) {
    const konto = await this.db.betreiber.findUnique({ where: { username: username.trim().toLowerCase() } });
    const gleich = await bcrypt.compare(passwort, konto?.passwordHash ?? ATTRAPPE);
    const meldung = "Benutzername oder Passwort stimmt nicht.";

    if (!konto || !konto.aktiv) {
      throw new UnauthorizedException(meldung);
    }
    if (konto.lockedUntil && konto.lockedUntil > new Date()) {
      throw new ForbiddenException("Das Konto ist vorübergehend gesperrt. Bitte später erneut versuchen.");
    }
    if (!gleich) {
      await this.zaehleFehlversuch(konto.id, konto.failedLoginCount);
      throw new UnauthorizedException(meldung);
    }

    if (!konto.totpEnabledAt) {
      // Einrichtung ist Pflicht, aber ohne Sitzung käme niemand dorthin.
      return { sitzung: await this.sitzung(konto.id, konto.tokenVersion, true), mfaErforderlich: false };
    }
    return {
      mfaErforderlich: true,
      zwischentoken: await this.jwt.signAsync(
        { sub: konto.id, schritt: "mfa" },
        { expiresIn: "5m", secret: this.zwischenSchluessel() },
      ),
    };
  }

  /** Schritt 2: Code aus der App oder ein Wiederherstellungscode. */
  async pruefeCode(zwischentoken: string, eingabe: string) {
    let sub: string;
    try {
      const inhalt = await this.jwt.verifyAsync<{ sub: string; schritt: string }>(zwischentoken, {
        secret: this.zwischenSchluessel(),
      });
      if (inhalt.schritt !== "mfa") throw new Error();
      sub = inhalt.sub;
    } catch {
      throw new UnauthorizedException("Die Anmeldung ist abgelaufen. Bitte von vorn beginnen.");
    }

    const konto = await this.db.betreiber.findUnique({ where: { id: sub } });
    if (!konto || !konto.aktiv || !konto.totpSecret || !konto.totpEnabledAt) {
      throw new UnauthorizedException("Die Anmeldung ist ungültig.");
    }
    if (konto.lockedUntil && konto.lockedUntil > new Date()) {
      throw new ForbiddenException("Das Konto ist vorübergehend gesperrt. Bitte später erneut versuchen.");
    }

    const schritt = pruefeTotp(entschluessele(konto.totpSecret), eingabe, konto.totpLastStep);
    let gueltig = false;
    if (schritt !== null) {
      // Atomar fortschreiben: derselbe Code gilt nur einmal, auch bei Gleichzeitigkeit.
      const treffer = await this.db.betreiber.updateMany({
        where: { id: konto.id, OR: [{ totpLastStep: null }, { totpLastStep: { lt: schritt } }] },
        data: { totpLastStep: schritt },
      });
      gueltig = treffer.count === 1;
    } else {
      const hash = hashWiederherstellungscode(eingabe);
      if (konto.totpRecoveryHashes.includes(hash)) {
        const treffer = await this.db.betreiber.updateMany({
          where: { id: konto.id, totpRecoveryHashes: { has: hash } },
          data: { totpRecoveryHashes: konto.totpRecoveryHashes.filter((eintrag) => eintrag !== hash) },
        });
        gueltig = treffer.count === 1;
        if (gueltig)
          await this.protokoll.schreibe(
            konto,
            "auth.wiederherstellungscode",
            "betreiber",
            konto.id,
            "Wiederherstellungscode verbraucht",
          );
      }
    }
    if (!gueltig) {
      await this.zaehleFehlversuch(konto.id, konto.failedLoginCount);
      throw new UnauthorizedException("Der Code stimmt nicht.");
    }

    await this.db.betreiber.update({
      where: { id: konto.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
    await this.protokoll.schreibe(konto, "auth.login", "betreiber", konto.id, "Angemeldet");
    return this.sitzung(konto.id, konto.tokenVersion, false);
  }

  async mfaBeginnen(id: string, username: string) {
    if (!istVerschluesselungMoeglich()) {
      throw new BadRequestException("SECRET_KEY ist nicht gesetzt - der zweite Faktor kann nicht gespeichert werden.");
    }
    const konto = await this.db.betreiber.findUniqueOrThrow({ where: { id } });
    if (konto.totpEnabledAt) {
      throw new BadRequestException("Der zweite Faktor ist bereits eingerichtet.");
    }
    const geheimnis = neuesTotpGeheimnis();
    await this.db.betreiber.update({ where: { id }, data: { totpSecret: verschluessele(geheimnis) } });
    return { geheimnis, adresse: totpAdresse(geheimnis, username, "AHOI Verwaltung") };
  }

  async mfaBestaetigen(id: string, code: string) {
    const konto = await this.db.betreiber.findUniqueOrThrow({ where: { id } });
    if (!konto.totpSecret || konto.totpEnabledAt) {
      throw new BadRequestException("Es läuft keine Einrichtung.");
    }
    const schritt = pruefeTotp(entschluessele(konto.totpSecret), code);
    if (schritt === null) {
      throw new BadRequestException("Der Code stimmt nicht.");
    }
    const codes = neueWiederherstellungscodes();
    await this.db.betreiber.update({
      where: { id },
      data: {
        totpEnabledAt: new Date(),
        totpLastStep: schritt,
        totpRecoveryHashes: codes.map(hashWiederherstellungscode),
        tokenVersion: { increment: 1 },
      },
    });
    await this.protokoll.schreibe(konto, "auth.mfa", "betreiber", id, "Zweiter Faktor eingerichtet");
    // Die laufende Sitzung endet mit der neuen Version - danach neu anmelden, jetzt mit Code.
    return { wiederherstellungscodes: codes };
  }

  async passwortAendern(id: string, aktuell: string, neu: string) {
    const konto = await this.db.betreiber.findUniqueOrThrow({ where: { id } });
    if (!(await bcrypt.compare(aktuell, konto.passwordHash))) {
      throw new BadRequestException("Das aktuelle Passwort stimmt nicht.");
    }
    await this.db.betreiber.update({
      where: { id },
      data: { passwordHash: await bcrypt.hash(neu, 12), tokenVersion: { increment: 1 } },
    });
    await this.protokoll.schreibe(konto, "auth.passwort", "betreiber", id, "Passwort geändert");
  }

  /** Beendet alle Sitzungen des Kontos. */
  async abmelden(id: string) {
    await this.db.betreiber.update({ where: { id }, data: { tokenVersion: { increment: 1 } } });
  }

  private async zaehleFehlversuch(id: string, bisher: number) {
    const neu = bisher + 1;
    await this.db.betreiber.update({
      where: { id },
      data:
        neu >= MAX_FEHLVERSUCHE
          ? { failedLoginCount: 0, lockedUntil: new Date(Date.now() + SPERRE_MINUTEN * 60_000) }
          : { failedLoginCount: neu },
    });
  }

  private sitzung(id: string, tokenVersion: number, mfaOffen: boolean): Promise<string> {
    const inhalt: SitzungsToken = { sub: id, tokenVersion, mfaOffen };
    return this.jwt.signAsync(inhalt);
  }

  private zwischenSchluessel(): string {
    return `${process.env.VERWALTUNG_JWT_SECRET}:mfa`;
  }
}
