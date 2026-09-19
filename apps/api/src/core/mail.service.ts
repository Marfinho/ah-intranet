import { Injectable, Logger } from "@nestjs/common";
import { createTransport, type Transporter } from "nodemailer";

export interface MailInput {
  to: string;
  subject: string;
  /** Reiner Text. Bewusst kein HTML: eine Mail aus dem Intranet ist eine Nachricht, kein Prospekt. */
  text: string;
}

/**
 * E-Mail-Versand.
 *
 * Der Weg nach draußen, wenn jemand nicht angemeldet ist - vergessenes Passwort,
 * ein neues Konto, eine Entscheidung über einen Antrag.
 *
 * **Ohne SMTP-Konfiguration ist der Versand aus.** Dann wird nichts
 * vorgetäuscht: `send` meldet `false`, und der Aufrufer entscheidet, was das
 * bedeutet. Ein stiller Fehlschlag wäre schlimmer als ein sichtbarer - beim
 * Passwort führte er dazu, dass Menschen auf eine Mail warten, die nie kommt.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor() {
    const host = process.env.SMTP_HOST;
    if (!host) {
      this.logger.warn("SMTP_HOST ist nicht gesetzt - der E-Mail-Versand ist aus.");
      return;
    }

    this.transporter = createTransport({
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      // `secure` heißt TLS von der ersten Sekunde (Port 465). Auf 587 beginnt
      // die Verbindung im Klartext und wird per STARTTLS hochgestuft.
      secure: process.env.SMTP_SECURE === "true",
      ...(process.env.SMTP_USER
        ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD ?? "" } }
        : {}),
    });
  }

  get istEingerichtet(): boolean {
    return this.transporter !== null;
  }

  /** Absenderadresse, wie sie beim Empfänger steht. */
  private get absender(): string {
    return process.env.SMTP_FROM ?? "AHOI <noreply@localhost>";
  }

  /**
   * Versendet eine Nachricht. Gibt zurück, ob sie den Server erreicht hat.
   *
   * Geworfen wird nicht: eine fehlgeschlagene Mail darf den Fachvorgang nicht
   * mitreißen. Ein freigegebener Urlaubsantrag bleibt freigegeben, auch wenn
   * die Benachrichtigung hängenbleibt.
   */
  async send(input: MailInput): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn(`E-Mail "${input.subject}" nicht versendet - kein SMTP eingerichtet.`);
      return false;
    }

    try {
      await this.transporter.sendMail({
        from: this.absender,
        to: input.to,
        subject: input.subject,
        text: input.text,
      });
      return true;
    } catch (error) {
      // Ohne Empfängeradresse im Protokoll: wer eine Mail bekommt, steht sonst
      // in jeder Logzeile, die das Einsammeln der Umgebung mitnimmt.
      this.logger.error(`E-Mail "${input.subject}" konnte nicht versendet werden`, error as Error);
      return false;
    }
  }
}
