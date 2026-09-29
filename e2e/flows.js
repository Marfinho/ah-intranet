const { chromium } = require("playwright");

const { MODULE_DEFINITIONS } = require("../packages/shared/dist");
const TENANT = process.env.E2E_TENANT || "autohaus-mueller";
const ZWEITES_HAUS = process.env.E2E_TENANT_B || "autohaus-nord";
const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
const PASS = process.env.E2E_PASSWORD || "Intranet2026!";
const results = [];

/**
 * Die Anmeldung kennt keine Haus-Kennung mehr im Formular - das Haus steht
 * über die Subdomain fest (siehe docs/lokal-testen.md). `E2E_BASE_URL` ohne
 * Subdomain (Standard: `http://localhost:3000`) wird deshalb je Haus um die
 * Kennung ergänzt, genauso wie es ein Reverse Proxy für echte Häuser täte.
 */
function baseFor(slug) {
  const url = new URL(BASE);
  url.hostname = `${slug}.${url.hostname}`;
  return url.origin;
}

let base = baseFor(TENANT);

function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " :: " + detail : ""}`);
}

async function login(page, username, loginBase = base) {
  await page.goto(`${loginBase}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', PASS);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 20000 }),
    page.click('button[type="submit"]'),
  ]);
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const ctx = await browser.newContext({ locale: "de-DE" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("dialog", (d) => {
    d.accept().catch(() => {});
  });

  try {
    // 1. Falsche Zugangsdaten
    await page.goto(`${base}/login`, { waitUntil: "networkidle" });
    await page.fill('input[name="username"]', "admin");
    await page.fill('input[name="password"]', "falsch");
    await page.click('form button[type="submit"]');
    await page.waitForSelector('[role="status"]', { timeout: 10000 });
    check("Falsches Passwort wird abgewiesen", (await page.textContent('[role="status"]')).includes("Ungültige"));

    // 1b. Vergessenes Passwort - ohne Anmeldung erreichbar, und die Antwort
    // verrät nicht, ob es die Kennung gibt.
    await page.goto(`${base}/login`, { waitUntil: "networkidle" });
    await page.click('a[href="/passwort-vergessen"]');
    await page.waitForURL((u) => u.pathname === "/passwort-vergessen", { timeout: 10000 });
    check("Weg zum vergessenen Passwort führt vom Anmeldeformular dorthin", true);

    await page.fill('input[name="username"]', "gibtesnicht");
    await page.click('form button[type="submit"]');
    await page.waitForSelector('[role="status"]', { timeout: 10000 });
    const auskunft = await page.textContent('[role="status"]');
    check("Antwort verrät nicht, ob es das Konto gibt", auskunft.includes("Wenn es zu dieser Kennung"));

    // Ohne Token gibt es kein Formular, sondern einen Hinweis.
    await page.goto(`${base}/passwort-neu`, { waitUntil: "networkidle" });
    check("Setzen ohne Link zeigt keinen Eingabeweg", (await page.locator('input[name="password"]').count()) === 0);

    // 2. Login als Mitarbeiter
    await login(page, "p.hansen");
    check("Login als Mitarbeiter", page.url() === `${base}/`, page.url());
    const body = await page.textContent("body");
    check("Dashboard zeigt echten Namen", body.includes("Paul Hansen"));

    // 3. Navigation enthält Module, aber keine Freigaben für Mitarbeitende
    check("Navigation ohne Freigaben für Mitarbeitende", !(await page.locator('nav a[href="/freigaben"]').count()));
    check("Navigation enthält Raumbuchung", (await page.locator('nav a[href="/raeume"]').count()) > 0);

    // 4. Visitenkartenbestellung anlegen
    await page.goto(`${base}/bestellungen/visitenkarten`, { waitUntil: "networkidle" });
    await page.fill('input[name="field:fullName"]', "Paul Hansen");
    await page.fill('input[name="field:jobTitle"]', "Verkaufsberater Neuwagen");
    await page.selectOption('select[name="field:location"]', "Hauptbetrieb Bremen");
    await page.fill('input[name="field:phone"]', "0421 5550-310");
    await page.fill('input[name="field:email"]', "p.hansen@autohaus-beispiel.de");
    await page.fill('input[name="quantity"]', "150");
    await page.click('main form button[type="submit"]');
    await page.waitForSelector('[role="status"]', { timeout: 15000 });
    check("Bestellung eingereicht", (await page.textContent('[role="status"]')).includes("eingereicht"));

    // 5. Bestellung taucht in der Liste auf
    await page.goto(`${base}/bestellungen/meine`, { waitUntil: "networkidle" });
    check("Bestellung erscheint in Meine Bestellungen", (await page.textContent("body")).includes("Auflage 150"));

    // 6. Ticket anlegen
    await page.goto(`${base}/tickets`, { waitUntil: "networkidle" });
    await page.fill('input[name="title"]', "Monitor flackert");
    await page.fill('textarea[name="description"]', "Der zweite Monitor am Verkaufstresen flackert seit gestern.");
    await page.click('main form button[type="submit"]');
    await page.waitForSelector('[role="status"]', { timeout: 15000 });
    check("Ticket angelegt", (await page.textContent("body")).includes("Monitor flackert"));

    // 7. Abwesenheitsantrag mit ungültigem Zeitraum
    await page.goto(`${base}/abwesenheiten`, { waitUntil: "networkidle" });
    await page.fill('input[name="startDate"]', "2026-12-20");
    await page.fill('input[name="endDate"]', "2026-12-10");
    await page.click('main form button[type="submit"]');
    await page.waitForSelector('[role="status"]', { timeout: 15000 });
    check("Enddatum vor Startdatum wird abgewiesen", (await page.textContent('[role="status"]')).includes("Enddatum"));

    // 8. Idee abstimmen
    await page.goto(`${base}/ideen`, { waitUntil: "networkidle" });
    const voteBtn = page.locator("button[aria-pressed]").first();
    const before = await voteBtn.textContent();
    await voteBtn.click();
    await page.waitForTimeout(2500);
    const after = await page.locator("button[aria-pressed]").first().textContent();
    check("Zustimmung zu Idee wird gespeichert", before !== after, `${before?.trim()} -> ${after?.trim()}`);

    // 9. Direktzugriff auf Adminbereich als Mitarbeiter
    await page.goto(`${base}/admin/module`, { waitUntil: "networkidle" });
    check("Mitarbeiter wird aus der Modulsteuerung umgeleitet", page.url() === `${base}/`, page.url());

    // 10. Als Admin anmelden
    await page.goto(`${base}/profil`, { waitUntil: "networkidle" });
    await page.click('form button[aria-label="Abmelden"]');
    await page.waitForURL(`${base}/login`, { timeout: 15000 });
    check("Abmelden funktioniert", page.url() === `${base}/login`);

    await login(page, "admin");
    check("Login als Admin", page.url() === `${base}/`);

    // 11. Modul abschalten
    await page.goto(`${base}/admin/module`, { waitUntil: "networkidle" });
    check("Modulsteuerung erreichbar", (await page.textContent("body")).includes("Kernmodul"));

    const coreSwitch = page.locator('button[role="switch"][aria-label*="Administration"]').first();
    check("Kernmodul-Schalter ist gesperrt", await coreSwitch.isDisabled());

    // Dialoge werden global bestätigt
    await page.locator('button[role="switch"][aria-label*="Raumbuchung"]').first().click();
    await page.waitForTimeout(3000);
    check(
      "Raumbuchung deaktiviert",
      (await page.locator('button[role="switch"][aria-label="Raumbuchung aktivieren"]').count()) > 0,
    );

    // 12. Deaktiviertes Modul ist nicht mehr erreichbar
    await page.goto(`${base}/raeume`, { waitUntil: "networkidle" });
    check("Route des Moduls gesperrt", page.url().includes("/modul-deaktiviert"), page.url());
    await page.goto(`${base}/`, { waitUntil: "networkidle" });
    check("Modul aus Navigation entfernt", (await page.locator('nav a[href="/raeume"]').count()) === 0);

    // 13. Abhängigkeit: Bestellungen aus -> Freigaben aus
    await page.goto(`${base}/admin/module`, { waitUntil: "networkidle" });
    // Dialoge werden global bestätigt
    await page.locator('button[role="switch"][aria-label*="Bestellungen"]').first().click();
    await page.waitForTimeout(3000);
    check(
      "Freigaben folgen Bestellungen in die Deaktivierung",
      (await page.locator('button[role="switch"][aria-label="Freigaben aktivieren"]').count()) > 0,
    );

    // 14. Zurücksetzen
    // Dialoge werden global bestätigt
    await page.click('main button:has-text("Auf Standard zurücksetzen")');
    await page.waitForTimeout(3000);
    // Nicht "alle an": Schnittstellen und Fahrzeugbestand werden bewusst
    // abgeschaltet ausgeliefert. Maßstab ist die Registry, keine feste Zahl.
    const standardmaessigAus = MODULE_DEFINITIONS.filter((m) => !m.core && !m.defaultEnabled);
    const aus = await page.locator(String.raw`button[role="switch"][aria-checked="false"]`).count();
    check(
      `Zurücksetzen stellt den Auslieferungszustand her (${standardmaessigAus.length} Module aus)`,
      aus === standardmaessigAus.length,
      `${aus} aus, erwartet ${standardmaessigAus.length}`,
    );

    // 15. Freigabe erteilen als Admin
    await page.goto(`${base}/freigaben`, { waitUntil: "networkidle" });
    const hasApprovals = (await page.locator('button:has-text("Genehmigen")').count()) > 0;
    check("Freigabenliste zeigt offene Vorgänge", hasApprovals);
    if (hasApprovals) {
      await page.locator('button:has-text("Genehmigen")').first().click();
      await page.waitForTimeout(3000);
      check("Freigabe erteilt", (await page.textContent("body")).includes("Sammelbestellung"));
    }

    // 16. News veröffentlichen
    await page.goto(`${base}/admin/news`, { waitUntil: "networkidle" });
    await page.fill('input[name="title"]', "Testbeitrag aus der Abnahme");
    await page.fill('textarea[name="teaser"]', "Kurzfassung des Testbeitrags.");
    await page.fill('textarea[name="content"]', "Ausführlicher Inhalt des Testbeitrags für die Abnahme.");
    await page.selectOption('select[name="status"]', "published");
    await page.click('main form button[type="submit"]');
    await page.waitForTimeout(3000);
    await page.goto(`${base}/aktuelles`, { waitUntil: "networkidle" });
    check("Neuer Beitrag ist veröffentlicht", (await page.textContent("body")).includes("Testbeitrag aus der Abnahme"));

    // 17. Globale Suche
    await page.goto(`${base}/suche?q=Hochvolt`, { waitUntil: "networkidle" });
    const searchBody = await page.textContent("body");
    check(
      "Globale Suche liefert modulübergreifende Treffer",
      searchBody.includes("Aktuelles") && searchBody.includes("Wissensdatenbank"),
    );

    // 18. Audit-Log protokolliert die Modulschaltung
    await page.goto(`${base}/admin/audit`, { waitUntil: "networkidle" });
    const auditBody = await page.textContent("body");
    check(
      "Audit-Log enthält Modulaktionen",
      auditBody.includes("module.disable") || auditBody.includes("module.reset"),
    );
    check("Audit-Log enthält Bestellfreigabe", auditBody.includes("order."));

    // 19. Eigene Rolle im Browser anlegen und zuweisen
    await page.goto(`${base}/admin/rollen`, { waitUntil: "networkidle" });
    await page.fill('input[name="name"]', "Werkstattleitung");
    await page.fill('input[name="description"]', "Leitet die Werkstatt");
    await page.fill('input[name="rank"]', "15");
    await page.check('input[name="permissions"][value="tickets.manage"]');
    await page.check('input[name="permissions"][value="absences.approve"]');
    // Formularbezogen klicken: die Kopfzeile trägt eine eigene Suchschaltfläche.
    await page.click('form:has(input[name="name"]) button[type="submit"]');
    await page.waitForTimeout(2500);
    await page.goto(`${base}/admin/rollen`, { waitUntil: "networkidle" });
    const rollenBody = await page.textContent("body");
    check("Eigene Rolle angelegt", rollenBody.includes("Werkstattleitung"));
    check("Eigene Rolle trägt keinen Systemvermerk", !/Werkstattleitung[\s\S]{0,400}Grundausstattung/.test(rollenBody));

    await page.goto(`${base}/admin/benutzer`, { waitUntil: "networkidle" });
    check(
      "Eigene Rolle steht in der Benutzerverwaltung zur Auswahl",
      (await page.textContent("body")).includes("Werkstattleitung"),
    );

    // 20. Mandantentrennung im Browser
    await page.goto(`${base}/admin`, { waitUntil: "networkidle" });
    check("Kopfzeile nennt das angemeldete Haus", (await page.textContent("header")).includes("Müller"));
    check(
      "Kein Kunden-Admin sieht die Plattformverwaltung",
      (await page.locator('a[href^="/plattform"]').count()) === 0,
    );

    // Die Plattformverwaltung liegt in einem eigenen Mandanten, nicht bei
    // einem Kunden - ein gewöhnlicher Admin darf dort nichts sehen.
    await page.goto(`${base}/plattform`, { waitUntil: "networkidle" });
    check("Fremder Zugriff auf die Plattformverwaltung wird abgewiesen", page.url() === `${base}/`, page.url());

    const newsA = await page
      .goto(`${base}/aktuelles`, { waitUntil: "networkidle" })
      .then(() => page.textContent("main"));

    await page.goto(`${base}/profil`, { waitUntil: "networkidle" });
    await page.click('form button[aria-label="Abmelden"]');
    await page.waitForURL(`${base}/login`, { timeout: 15000 });

    // Gleicher Benutzername, anderes Haus - das muss ein anderes Konto sein.
    // Die Kennung steckt jetzt in der Subdomain, nicht mehr im Formular.
    base = baseFor(ZWEITES_HAUS);
    await login(page, "admin");
    check("Anmeldung im zweiten Haus", !page.url().includes("/login"), page.url());
    check("Kopfzeile wechselt mit dem Haus", (await page.textContent("header")).includes("Nord"));

    await page.goto(`${base}/aktuelles`, { waitUntil: "networkidle" });
    const newsB = await page.textContent("main");
    check(
      "Beiträge des ersten Hauses sind im zweiten nicht sichtbar",
      !newsB.includes("Testbeitrag aus der Abnahme") && newsA !== newsB,
    );

    check("Keine JavaScript-Fehler im Browser", errors.length === 0, errors.slice(0, 3).join(" | "));
  } catch (error) {
    check("Durchlauf ohne Abbruch", false, String(error).slice(0, 300));
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} Prüfungen bestanden`);
  process.exit(failed.length ? 1 : 0);
})();
