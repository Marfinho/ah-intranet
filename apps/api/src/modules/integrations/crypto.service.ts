import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/**
 * Verschlüsselt Zugangsdaten zu Fremdsystemen vor der Ablage in der Datenbank.
 *
 * AES-256-GCM: jeder Wert bekommt eine eigene Zufalls-IV, das Authentifizierungs-
 * Tag wird mitgespeichert. Ein manipulierter Datenbankeintrag lässt sich damit
 * nicht unbemerkt entschlüsseln, sondern schlägt beim Entschlüsseln fehl.
 *
 * Format: `v1:<iv-base64>:<tag-base64>:<ciphertext-base64>`
 */
@Injectable()
export class IntegrationCryptoService {
  private static readonly PREFIX = "v1";
  private static readonly IV_BYTES = 12;

  private readonly logger = new Logger(IntegrationCryptoService.name);
  private cachedKey: Buffer | null = null;

  constructor(private readonly config: ConfigService) {}

  /**
   * Der Schlüssel kommt aus `INTEGRATION_SECRET_KEY`. Ist die Variable nicht
   * gesetzt, lassen sich Zugangsdaten weder speichern noch lesen - das ist
   * beabsichtigt, damit Geheimnisse nie unverschlüsselt in der Datenbank landen.
   */
  private key(): Buffer {
    if (this.cachedKey) {
      return this.cachedKey;
    }

    const configured = this.config.get<string>("INTEGRATION_SECRET_KEY");
    if (!configured || configured.trim().length < 16) {
      throw new InternalServerErrorException(
        "INTEGRATION_SECRET_KEY ist nicht oder zu kurz gesetzt. Ohne diesen Schlüssel können keine Zugangsdaten zu Fremdsystemen gespeichert werden.",
      );
    }

    // Feste Salt-Konstante: der Schlüssel soll über Neustarts hinweg stabil sein.
    this.cachedKey = scryptSync(configured, "ah-intranet.integrations.v1", 32);
    return this.cachedKey;
  }

  /** Meldet, ob Geheimnisse überhaupt verarbeitet werden können. */
  isConfigured(): boolean {
    try {
      this.key();
      return true;
    } catch {
      return false;
    }
  }

  encrypt(plain: string): string {
    const iv = randomBytes(IntegrationCryptoService.IV_BYTES);
    const cipher = createCipheriv("aes-256-gcm", this.key(), iv);
    const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);

    return [
      IntegrationCryptoService.PREFIX,
      iv.toString("base64"),
      cipher.getAuthTag().toString("base64"),
      encrypted.toString("base64"),
    ].join(":");
  }

  decrypt(payload: string): string {
    const [prefix, ivPart, tagPart, dataPart] = payload.split(":");
    if (prefix !== IntegrationCryptoService.PREFIX || !ivPart || !tagPart || !dataPart) {
      throw new InternalServerErrorException("Gespeicherte Zugangsdaten haben ein unbekanntes Format.");
    }

    try {
      const decipher = createDecipheriv("aes-256-gcm", this.key(), Buffer.from(ivPart, "base64"));
      decipher.setAuthTag(Buffer.from(tagPart, "base64"));
      return Buffer.concat([decipher.update(Buffer.from(dataPart, "base64")), decipher.final()]).toString("utf8");
    } catch (error) {
      this.logger.error("Zugangsdaten konnten nicht entschlüsselt werden", error as Error);
      throw new InternalServerErrorException(
        "Zugangsdaten konnten nicht entschlüsselt werden. Wurde INTEGRATION_SECRET_KEY nachträglich geändert?",
      );
    }
  }
}
