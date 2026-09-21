import { Injectable, Logger } from "@nestjs/common";
import * as nodemailer from "nodemailer";

/**
 * Versand einfacher Warn-E-Mails des Betreibers (Systemlast).
 *
 * Kein Fachmodul, kein Postfach für Mandanten - ausschließlich das
 * Warnsystem in `SystemMonitorService` nutzt dies, um die Plattformverwaltung
 * zu erreichen, wenn die Maschine unter Last gerät.
 *
 * Ohne vollständige SMTP-Angaben wird nichts verschickt, nur eine Warnung
 * geloggt - lieber eine klare Absage als ein Versand ins Leere, der den
 * eigentlichen Zustand verschleiert.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  private istEingerichtet(): boolean {
    return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
  }

  async send(input: { to: string; subject: string; text: string }): Promise<boolean> {
    if (!this.istEingerichtet()) {
      this.logger.warn(`E-Mail nicht verschickt (SMTP_HOST/SMTP_FROM fehlt): "${input.subject}" an ${input.to}`);
      return false;
    }

    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
      secure: process.env.SMTP_SECURE === "true",
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
    });

    try {
      await transport.sendMail({
        from: process.env.SMTP_FROM,
        to: input.to,
        subject: input.subject,
        text: input.text,
      });
      return true;
    } catch (error) {
      this.logger.error(`E-Mail-Versand fehlgeschlagen: ${(error as Error).message}`);
      return false;
    }
  }
}
