import "dotenv/config";
import * as bcrypt from "bcryptjs";
import { neuerClient } from "./klient";

/**
 * Legt ein Konto der Verwaltung an - der einzige Weg, ein erstes zu bekommen.
 *
 *   BETREIBER_PASSWORT='…' pnpm --filter verwaltung betreiber:anlegen <benutzername> "<Anzeigename>" [inhaber|lesend]
 *
 * Das Passwort kommt aus der Umgebung, nicht aus einem Argument: Argumente
 * stehen in der Prozessliste und im Verlauf der Shell.
 */
async function main() {
  const [username, anzeigename, rolle = "inhaber"] = process.argv.slice(2);
  const passwort = process.env.BETREIBER_PASSWORT;
  if (!username || !anzeigename || !passwort) {
    console.error("Aufruf: BETREIBER_PASSWORT='…' betreiber:anlegen <benutzername> \"<Anzeigename>\" [inhaber|lesend]");
    process.exit(1);
  }
  if (passwort.length < 12) {
    console.error("Das Passwort muss mindestens 12 Zeichen lang sein.");
    process.exit(1);
  }
  if (rolle !== "inhaber" && rolle !== "lesend") {
    console.error('Die Rolle ist "inhaber" oder "lesend".');
    process.exit(1);
  }
  const db = neuerClient();
  const name = username.trim().toLowerCase();
  const vorhanden = await db.betreiber.findUnique({ where: { username: name } });
  const passwordHash = await bcrypt.hash(passwort, 12);
  if (vorhanden) {
    // Erneuter Aufruf setzt das Passwort neu (verlorenes Passwort) und beendet alle Sitzungen.
    await db.betreiber.update({
      where: { id: vorhanden.id },
      data: { passwordHash, tokenVersion: { increment: 1 }, aktiv: true, failedLoginCount: 0, lockedUntil: null },
    });
    console.log(`Konto "${name}" existierte - Passwort neu gesetzt, Sitzungen beendet.`);
  } else {
    await db.betreiber.create({ data: { username: name, displayName: anzeigename, passwordHash, rolle } });
    console.log(`Konto "${name}" (${rolle}) angelegt. Der zweite Faktor wird bei der ersten Anmeldung eingerichtet.`);
  }
  await db.$disconnect();
}

void main();
