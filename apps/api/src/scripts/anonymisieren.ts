/**
 * Ersetzt in einer ganzen Datenbank die Personen durch Kunstfiguren.
 *
 * Gedacht für Erprobungsumgebungen: Ein Pilotsystem wird aus einer Sicherung
 * der Produktion befüllt, damit Menge und Verflechtung der Daten realistisch
 * sind – aber echte Mitarbeiterdaten dürfen dort nicht liegen.
 *
 *   node dist/scripts/anonymisieren.js --ja-diese-datenbank
 *
 * Der Schalter ist Absicht: Ein versehentlicher Aufruf gegen die Produktion
 * wäre nicht rückgängig zu machen. Das Skript nennt vorher die Datenbank, auf
 * die es zeigt, und bricht ohne Schalter ab.
 *
 * **Kunstnamen statt „Gelöschte Person".** Die Löschung nach Art. 17 entfernt
 * die Identität und nimmt in Kauf, dass das Konto unkenntlich wird – dort ist
 * genau das der Zweck. Eine Erprobungsumgebung, in der zwanzig Mal dieselbe
 * namenlose Person steht, kann niemand bedienen: Freigabewege, Verzeichnis und
 * Zuweisungen werden unlesbar. Deshalb bekommt hier jede Person einen
 * erfundenen, aber stabilen Namen.
 *
 * Was das Skript NICHT kann: Freitexte. Ein Ticket mit „Rückfrage an Frau
 * Meier" bleibt stehen, weil kein Datenfeld darauf zeigt. Es zählt am Ende auf,
 * wie viele es gibt – durchsehen muss sie ein Mensch.
 */
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const ERPROBUNGSKENNWORT = process.env.ERPROBUNG_PASSWORT ?? "Erprobung2026!";

/** Namen ohne Bezug zu realen Beschäftigten, lang genug gegen Dopplungen. */
const VORNAMEN = [
  "Alina",
  "Bernd",
  "Clara",
  "Dominik",
  "Elif",
  "Fabian",
  "Greta",
  "Hendrik",
  "Ida",
  "Jonas",
  "Katrin",
  "Lennart",
  "Mira",
  "Noah",
  "Olivia",
  "Paul",
  "Quirin",
  "Rieke",
  "Samuel",
  "Tamara",
  "Ulrich",
  "Vera",
  "Wanda",
  "Yannick",
];

const NACHNAMEN = [
  "Ahrens",
  "Brandt",
  "Cordes",
  "Dierks",
  "Engel",
  "Freese",
  "Gerdes",
  "Harms",
  "Iversen",
  "Jansen",
  "Kuhlmann",
  "Lampe",
  "Mehrens",
  "Nolte",
  "Ostermann",
  "Prigge",
  "Renken",
  "Siefken",
  "Tholen",
  "Ubben",
  "Vogt",
  "Wessels",
];

/** Stabiler Streuwert: dieselbe Kennung ergibt immer denselben Namen. */
function streuwert(text: string): number {
  let wert = 0;
  for (let i = 0; i < text.length; i += 1) {
    wert = (wert * 31 + text.charCodeAt(i)) >>> 0;
  }
  return wert;
}

function kunstfigur(userId: string) {
  const wert = streuwert(userId);
  const vorname = VORNAMEN[wert % VORNAMEN.length];
  const nachname = NACHNAMEN[Math.floor(wert / VORNAMEN.length) % NACHNAMEN.length];
  // Die Kennung trägt einen Teil der Datensatz-ID, damit zwei gleiche Namen im
  // selben Haus nicht kollidieren – `username` ist je Mandant eindeutig.
  const kennung = `${vorname[0].toLowerCase()}.${nachname.toLowerCase()}${userId.slice(-3)}`;
  return {
    vorname,
    nachname,
    kennung,
    // `.invalid` ist reserviert und kann nie zugestellt werden: aus einer
    // Erprobungsumgebung darf niemals echte Post hinausgehen.
    email: `${kennung}@erprobung.invalid`,
  };
}

function datenbankname(url: string): string {
  const ohneParameter = url.split("?")[0];
  return ohneParameter.slice(ohneParameter.lastIndexOf("/") + 1);
}

async function main() {
  const bestaetigt = process.argv.includes("--ja-diese-datenbank");
  const name = datenbankname(process.env.DATABASE_URL ?? "");

  console.log(`Ziel: Datenbank "${name}"`);

  if (!bestaetigt) {
    console.error("");
    console.error("Abgebrochen. Dieses Skript überschreibt alle Personendaten unwiderruflich.");
    console.error(`Wenn "${name}" wirklich eine Kopie für die Erprobung ist:`);
    console.error("  node dist/scripts/anonymisieren.js --ja-diese-datenbank");
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    // Ein Kennwort für alle, einmal gehasht: bcrypt ist absichtlich langsam,
    // und hier zählt nur, dass man hineinkommt.
    const hash = await bcrypt.hash(ERPROBUNGSKENNWORT, 10);

    const personen = await prisma.user.findMany({ select: { id: true } });
    console.log(`${personen.length} Konten bekommen Kunstnamen …`);

    for (const person of personen) {
      const figur = kunstfigur(person.id);
      await prisma.user.update({
        where: { id: person.id },
        data: {
          username: figur.kennung,
          firstName: figur.vorname,
          lastName: figur.nachname,
          email: figur.email,
          phone: null,
          mobile: null,
          passwordHash: hash,
          mustChangePassword: false,
          lastLoginAt: null,
          failedLoginCount: 0,
          lockedUntil: null,
          // Rollen, Standort und Abteilung bleiben: ohne sie wären Freigabewege
          // und Zielgruppen nicht mehr zu erproben.
        },
      });
    }

    const benachrichtigungen = await prisma.notification.deleteMany({});
    const lesebestaetigungen = await prisma.newsRead.deleteMany({});
    const protokoll = await prisma.auditLog.deleteMany({});

    const [tickets, ticketKommentare, newsKommentare, artikel, ideen] = await Promise.all([
      prisma.ticket.count(),
      prisma.ticketComment.count(),
      prisma.newsComment.count(),
      prisma.wikiArticle.count(),
      prisma.idea.count(),
    ]);

    console.log("");
    console.log("Entfernt:");
    console.log(`  ${benachrichtigungen.count} Benachrichtigungen`);
    console.log(`  ${lesebestaetigungen.count} Lesebestätigungen`);
    console.log(`  ${protokoll.count} Protokolleinträge`);
    console.log("");
    console.log(`Alle Konten nutzen jetzt das Kennwort: ${ERPROBUNGSKENNWORT}`);
    console.log("Die Kennungen stehen im Mitarbeiterverzeichnis.");
    console.log("");
    console.log("NICHT angefasst – diese Freitexte können Personen namentlich nennen:");
    console.log(`  ${tickets} Serviceanfragen und ${ticketKommentare} Kommentare dazu`);
    console.log(`  ${newsKommentare} Kommentare zu Beiträgen`);
    console.log(`  ${artikel} Wiki-Artikel, ${ideen} Ideen`);
    console.log("Vor der Weitergabe an Dritte gehören sie durchgesehen.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Anonymisierung fehlgeschlagen:", error);
  process.exit(1);
});
