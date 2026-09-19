import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MailService } from "./mail.service";

describe("E-Mail-Versand", () => {
  const vorher = { ...process.env };

  beforeEach(() => {
    delete process.env.SMTP_HOST;
  });

  afterEach(() => {
    process.env = { ...vorher };
  });

  it("ist ohne SMTP_HOST aus", () => {
    expect(new MailService().istEingerichtet).toBe(false);
  });

  it("täuscht ohne Einrichtung keinen Versand vor", async () => {
    // Entscheidend: `false`, nicht `true`. Ein stiller Fehlschlag ließe
    // Menschen auf eine Mail warten, die nie kommt.
    const dienst = new MailService();
    await expect(dienst.send({ to: "a@b.de", subject: "Probe", text: "Probe" })).resolves.toBe(false);
  });

  it("ist mit SMTP_HOST eingerichtet", () => {
    process.env.SMTP_HOST = "smtp.beispiel.de";
    expect(new MailService().istEingerichtet).toBe(true);
  });

  it("wirft nicht, wenn der Server nicht erreichbar ist", async () => {
    // Eine fehlgeschlagene Mail darf den Fachvorgang nicht mitreißen: ein
    // freigegebener Antrag bleibt freigegeben.
    process.env.SMTP_HOST = "127.0.0.1";
    process.env.SMTP_PORT = "1";
    const dienst = new MailService();
    await expect(dienst.send({ to: "a@b.de", subject: "Probe", text: "Probe" })).resolves.toBe(false);
  });
});
