/**
 * Ersteinrichtungs-Assistent ("Einrichtung") - Admin-Flow.
 *
 * Nicht zu verwechseln mit der Einarbeitung neuer Mitarbeitender
 * (`/onboarding`). Legt über die Plattformverwaltung ein frisches Haus an,
 * meldet sich dort erstmals als Administration an und durchläuft das
 * Grundsetup: Willkommensdialog, Mandantenprofil, Standort, Mitarbeiter,
 * News. Prüft, dass der Fortschritt sich dabei live aktualisiert und die
 * Checkliste nach Abschluss der Pflichtschritte eine Erfolgsmeldung zeigt.
 */
const { chromium } = require("playwright");

const PLATFORM_TENANT = process.env.E2E_TENANT || "autohaus-mueller";
const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
const PASS = process.env.E2E_PASSWORD || "Intranet2026!";
const results = [];

function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " :: " + detail : ""}`);
}

async function login(page, username, tenant, password = PASS) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="tenant"]', tenant);
  await page.fill('input[name="password"]', password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 20000 }),
    page.click('button[type="submit"]'),
  ]);
}

async function logout(page) {
  await page.goto(`${BASE}/profil`, { waitUntil: "networkidle" });
  await page.click('form button[aria-label="Abmelden"]');
  await page.waitForURL(`${BASE}/login`, { timeout: 15000 });
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const ctx = await browser.newContext({ locale: "de-DE" });
  const page = await ctx.newPage();

  const slug = `einrichtung-e2e-${Date.now()}`;
  const adminUsername = "e.leiterin";
  const adminPassword = "Setup12345!";

  try {
    // 1. Ein frisches Haus über die Plattformverwaltung anlegen.
    await login(page, "admin", PLATFORM_TENANT);
    await page.goto(`${BASE}/admin/mandanten`, { waitUntil: "networkidle" });
    await page.fill('input[name="name"]', "Einrichtungstest GmbH");
    await page.fill('input[name="slug"]', slug);
    await page.fill('input[name="adminUsername"]', adminUsername);
    await page.fill('input[name="adminPassword"]', adminPassword);
    await page.fill('input[name="adminFirstName"]', "Erika");
    await page.fill('input[name="adminLastName"]', "Leiterin");
    await page.click('main form button[type="submit"]');
    await page.waitForSelector('[role="status"]', { timeout: 15000 });
    check("Neues Haus angelegt", (await page.textContent('[role="status"]')).includes("eingerichtet"));

    await logout(page);

    // 2. Erste Anmeldung im neuen Haus: der Willkommensdialog muss erscheinen.
    await login(page, adminUsername, slug, adminPassword);
    check("Anmeldung im neuen Haus landet auf dem Dashboard", page.url() === `${BASE}/`, page.url());

    await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
    const dialogText = await page.textContent('[role="dialog"]');
    check("Willkommensdialog erscheint bei der ersten Anmeldung", dialogText.includes("Willkommen bei AHOI"));
    check(
      "Willkommensdialog bietet die volle Einrichtung an (gruppenadmin-Variante)",
      dialogText.includes("Einrichtung starten"),
    );

    await page.click('[role="dialog"] button:has-text("Einrichtung starten")');
    await page.waitForSelector('[role="dialog"]', { state: "detached", timeout: 10000 });
    check("Dialog schließt sich ohne erneuten Seitenaufbau", page.url() === `${BASE}/`, page.url());

    // 3. Die Checkliste ist dauerhaft im Dashboard sichtbar.
    let dashboardBody = await page.textContent("body");
    check("Checkliste zeigt die Ersteinrichtung", dashboardBody.includes("Ersteinrichtung"));
    check(
      "Checkliste nennt den Schritt „Organisationsdaten vervollständigen“",
      dashboardBody.includes("Organisationsdaten"),
    );
    // Die Mandantenanlage legt bereits einen ersten Standort an (siehe
    // TenantService.create) - der Schritt "Standort" ist deshalb von Anfang an
    // erledigt, alle anderen Pflichtschritte noch offen.
    check(
      "Fortschritt beginnt bei 1 von 5 erledigten Schritten (Standort existiert bereits)",
      /1 von 5 Schritten erledigt/.test(dashboardBody),
    );

    // 4. Mandantenprofil vervollständigen.
    await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
    await page.fill('textarea[name="notes"]', "Filiale befindet sich noch im Aufbau.");
    await page.click('form:has(textarea[name="notes"]) button[type="submit"]');
    await page.waitForSelector('[role="status"]', { timeout: 15000 });
    check("Mandantenprofil gespeichert", (await page.textContent('[role="status"]')).includes("gespeichert"));

    // 5. Ersten Standort anlegen.
    await page.goto(`${BASE}/admin/organisation`, { waitUntil: "networkidle" });
    await page.fill('input[name="name"]', "Hauptstandort");
    await page.fill('input[name="code"]', "HS");
    await page.click('main form button[type="submit"]');
    await page.waitForSelector('[role="status"]', { timeout: 15000 });
    check("Standort angelegt", (await page.textContent("body")).includes("Hauptstandort"));

    // 6. Erste Mitarbeiterin einladen.
    await page.goto(`${BASE}/admin/benutzer`, { waitUntil: "networkidle" });
    await page.fill('input[name="username"]', "m.beispiel");
    await page.fill('input[name="firstName"]', "Mia");
    await page.fill('input[name="lastName"]', "Beispiel");
    await page.click('main form button[type="submit"]');
    await page.waitForSelector('[role="status"]', { timeout: 15000 });
    check("Mitarbeiterin angelegt", (await page.textContent('[role="status"]')).includes("Startpasswort"));

    // 7. Erste News veröffentlichen.
    await page.goto(`${BASE}/admin/news`, { waitUntil: "networkidle" });
    await page.fill('input[name="title"]', "Willkommen im neuen Haus");
    await page.fill('textarea[name="teaser"]', "Wir freuen uns auf den Start.");
    await page.fill('textarea[name="content"]', "Dies ist der erste Beitrag im neu eingerichteten Autohaus.");
    await page.selectOption('select[name="status"]', "published");
    await page.click('main form button[type="submit"]');
    await page.waitForSelector('[role="status"]', { timeout: 15000 });
    check("News veröffentlicht", (await page.textContent('[role="status"]')).includes("gespeichert"));

    // 8. Zurück auf dem Dashboard: der Fortschritt hat sich live aktualisiert.
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    dashboardBody = await page.textContent("body");
    check(
      "Alle Pflichtschritte sind nach den vier Aktionen erledigt",
      dashboardBody.includes("Alle Pflichtschritte sind erledigt"),
    );
    check(
      "Fortschritt zeigt vier von fünf Schritten (der Beispielprozess bleibt optional offen)",
      /4 von 5 Schritten erledigt/.test(dashboardBody),
    );

    // 9. Über das Profil lässt sich die Einrichtung jederzeit erneut aufrufen.
    await page.goto(`${BASE}/profil`, { waitUntil: "networkidle" });
    check("Profil verlinkt auf die Ersteinrichtung", (await page.locator('a[href="/einrichtung"]').count()) > 0);
    await page.click('a[href="/einrichtung"]');
    await page.waitForURL(`${BASE}/einrichtung`, { timeout: 10000 });
    check(
      "Ersteinrichtung-Seite zeigt die vollständige Checkliste",
      (await page.textContent("body")).includes("Ersteinrichtung"),
    );
  } catch (error) {
    check("Durchlauf ohne Abbruch", false, String(error).slice(0, 300));
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} Prüfungen bestanden`);
  process.exit(failed.length ? 1 : 0);
})();
