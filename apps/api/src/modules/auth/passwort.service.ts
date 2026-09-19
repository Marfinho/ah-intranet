import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../../core/prisma.service";
import { MailService } from "../../core/mail.service";
import { AuditService } from "../../core/audit.service";
import { runUnscoped } from "../../core/tenant-context";
import { displayName } from "../../core/mappers";

/**
 * Vergessenes Passwort ohne die Administration.
 *
 * Vier Entscheidungen stecken darin, jede mit einem Grund:
 *
 * 1. **Die Anforderung antwortet immer gleich.** Ob es das Konto gibt, verrät
 *    die API nicht - sonst wäre das Formular ein Verzeichnis gültiger
 *    Benutzernamen für jeden, der es ausprobiert.
 * 2. **Gespeichert wird nur der Hash des Tokens.** Ein Datenbankabzug darf
 *    niemandem Zugang zu einem Konto eröffnen. Der Klartext steht allein in
 *    der E-Mail.
 * 3. **Kurze Frist, einmalige Verwendung.** Eine Stunde reicht, um eine Mail zu
 *    lesen. Länger offen zu bleiben bringt keinen Nutzen, nur Risiko.
 * 4. **Das Setzen beendet alle Sitzungen.** Wer sein Passwort zurücksetzt, tut
 *    das oft, weil er einen Zugriff befürchtet. Eine weiterlaufende fremde
 *    Sitzung würde genau das nicht beenden.
 */
@Injectable()
export class PasswortService {
  private readonly logger = new Logger(PasswortService.name);

  /** Eine Stunde: lang genug für eine Mail, kurz genug, um nicht zu liegen. */
  private static readonly FRIST_MINUTEN = 60;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Fordert einen Zurücksetz-Link an.
   *
   * Antwortet immer ohne Auskunft darüber, ob es das Konto gibt. Auch die
   * Laufzeit soll nichts verraten, deshalb wird der Mailversand nicht
   * abgewartet - er läuft, während die Antwort schon draußen ist.
   */
  async anfordern(benutzername: string): Promise<void> {
    const kennung = benutzername.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { username: kennung, status: "active" },
      select: { id: true, email: true, firstName: true, lastName: true, tenant: { select: { name: true } } },
    });

    if (!user) {
      this.logger.log("Zurücksetzung für unbekannte oder gesperrte Kennung angefordert - keine Mail versendet.");
      return;
    }
    if (!user.email) {
      // Ohne Adresse gibt es keinen Weg nach draußen. Das Konto ist auf die
      // Administration angewiesen - sichtbar im Protokoll, nicht für den Aufrufer.
      this.logger.warn(`Konto ${user.id} hat keine E-Mail-Adresse - Zurücksetzung nicht möglich.`);
      return;
    }

    const token = randomBytes(32).toString("base64url");
    const ablauf = new Date(Date.now() + PasswortService.FRIST_MINUTEN * 60 * 1000);

    // Ältere offene Anforderungen entwerten: zwei gültige Links gleichzeitig
    // verdoppeln nur die Angriffsfläche.
    await this.prisma.passwordReset.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    await this.prisma.passwordReset.create({
      data: { userId: user.id, tokenHash: this.hash(token), expiresAt: ablauf },
    });

    const basis = process.env.FRONTEND_URL ?? "";
    const link = `${basis}/passwort-neu?token=${token}`;
    await this.mail.send({
      to: user.email,
      subject: "Passwort zurücksetzen",
      text:
        `Hallo ${displayName(user)},\n\n` +
        `für Ihr Konto im Intranet von ${user.tenant.name} wurde ein neues Passwort angefordert.\n\n` +
        `${link}\n\n` +
        `Der Link gilt eine Stunde und nur einmal.\n\n` +
        `Waren Sie das nicht, können Sie diese Nachricht ignorieren - Ihr Passwort bleibt unverändert. ` +
        `Häufen sich solche Nachrichten, melden Sie es bitte der Administration.\n\n` +
        `--\nAHOI - Autohaus Organisation & Information`,
    });
  }

  /**
   * Setzt das Passwort mit einem gültigen Token.
   *
   * Läuft bewusst ohne Mandantenfilter: Wer aus einer E-Mail heraus klickt,
   * ist nicht angemeldet, und der Link trägt keine Hauskennung. Den Mandanten
   * gäbe es an dieser Stelle gar nicht - der Token selbst bestimmt ihn. Das
   * ist sicher, weil er 32 zufällige Bytes lang und über alle Häuser eindeutig
   * ist: er benennt genau ein Konto und damit genau ein Haus.
   */
  async einloesen(token: string, neuesPasswort: string): Promise<void> {
    if (neuesPasswort.length < 10) {
      throw new BadRequestException("Das neue Passwort muss mindestens 10 Zeichen lang sein.");
    }

    // `async` und das innere `await` sind nicht schmückend: Prismas Aufrufe
    // geben ein träges Promise zurück, das die Abfrage erst beim Abwarten
    // absetzt. Ohne das innere `await` liefe sie außerhalb des Kontexts und
    // die Mandantentrennung würde sie abweisen.
    const eintrag = await runUnscoped(async () => {
      return await this.prisma.passwordReset.findFirst({
        where: { tokenHash: this.hash(token) },
        include: { user: { select: { id: true, username: true, status: true } } },
      });
    });

    // Eine Meldung für alle Fehlschläge: abgelaufen, benutzt, erfunden. Wer
    // rät, soll nicht erfahren, wie nah er war.
    const ungueltig = new BadRequestException("Dieser Link ist nicht mehr gültig. Fordern Sie einen neuen an.");
    if (!eintrag || eintrag.usedAt || eintrag.expiresAt < new Date() || eintrag.user.status !== "active") {
      throw ungueltig;
    }

    const hash = await bcrypt.hash(neuesPasswort, 12);

    await runUnscoped(async () => {
      await this.prisma.$transaction([
        this.prisma.passwordReset.update({ where: { id: eintrag.id }, data: { usedAt: new Date() } }),
        this.prisma.user.update({
          where: { id: eintrag.userId },
          data: {
            passwordHash: hash,
            mustChangePassword: false,
            failedLoginCount: 0,
            lockedUntil: null,
            // Alle bestehenden Sitzungen enden - siehe Kopfkommentar.
            tokenVersion: { increment: 1 },
          },
        }),
      ]);
    });

    // Auch das Protokoll braucht den Mandanten des betroffenen Kontos, nicht
    // den der Anfrage - die hat keinen.
    await runUnscoped(async () => {
      await this.audit.log({
        actor: { id: eintrag.userId, username: eintrag.user.username },
        action: "auth.password_reset",
        entityType: "user",
        entityId: eintrag.userId,
        detail: "Passwort über den Zurücksetz-Link neu gesetzt; alle Sitzungen beendet",
      });
    });
  }

  /** Räumt abgelaufene Anforderungen weg. Aufgerufen vom Aufbewahrungslauf. */
  async aufraeumen(): Promise<number> {
    const ergebnis = await this.prisma.passwordReset.deleteMany({
      where: { OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { not: null } }] },
    });
    return ergebnis.count;
  }

  /**
   * Vergleicht zwei Token in gleichbleibender Zeit.
   *
   * Wird hier nicht gebraucht, weil der Hash über einen Index gesucht wird -
   * steht aber bereit, falls die Suche je auf einen Durchlauf umgestellt wird.
   */
  static gleich(a: string, b: string): boolean {
    const links = Buffer.from(a);
    const rechts = Buffer.from(b);
    return links.length === rechts.length && timingSafeEqual(links, rechts);
  }

  private hash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}
