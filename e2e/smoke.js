const { chromium } = require("playwright");
const TENANT = process.env.E2E_TENANT || "autohaus-mueller";
const PLATFORM_TENANT = process.env.E2E_PLATFORM_TENANT || "verwaltung";
const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3000";
const PASSWORT = process.env.E2E_PASSWORD || "Intranet2026!";

/** Die Kennung steckt in der Subdomain, nicht mehr im Anmeldeformular. */
function baseFor(slug) {
  const url = new URL(BASE_URL);
  url.hostname = `${slug}.${url.hostname}`;
  return url.origin;
}

const ROUTES = [
  "/",
  "/aktuelles",
  "/mitarbeiter",
  "/dokumente",
  "/wissen",
  "/kalender",
  "/raeume",
  "/tickets",
  "/ideen",
  "/umfragen",
  "/abwesenheiten",
  "/onboarding",
  "/bestellungen/meine",
  "/bestellungen/visitenkarten",
  "/bestellungen/arbeitskleidung",
  "/freigaben",
  "/benachrichtigungen",
  "/schnellzugriffe",
  "/suche?q=service",
  "/profil",
  "/admin",
  "/admin/module",
  "/admin/benutzer",
  "/admin/rollen",
  "/admin/standorte",
  "/admin/anmeldung",
  "/schichtplan",
  "/verwahrung",
  "/essen",
  "/admin/news",
  "/admin/dokumente",
  "/admin/katalog",
  "/admin/formulare",
  "/admin/bestelltermine",
  "/admin/audit",
  "/admin/datenschutz",
];

/** Die Plattformverwaltung liegt in einem eigenen Mandanten mit eigenem Bereich. */
const PLATFORM_ROUTES = ["/plattform", "/plattform/status"];

function istKaputt(response, text, url) {
  return (
    response.status() >= 400 ||
    text.includes("Da ist etwas schiefgelaufen") ||
    text.includes("Seite nicht gefunden") ||
    // Eine stille Weiterleitung auf die Hinweisseite ist kein geladenes Modul.
    url.includes("/modul-deaktiviert")
  );
}

async function pruefeRouten(page, base, routen) {
  let bad = 0;
  for (const route of routen) {
    const r = await page.goto(base + route, { waitUntil: "networkidle" });
    const txt = await page.locator("body").innerText();
    const broken = istKaputt(r, txt, page.url());
    if (broken) bad++;
    console.log(`${broken ? "FAIL" : "ok  "} ${r.status()} ${route}`);
  }
  return bad;
}

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const p = await (await b.newContext({ locale: "de-DE" })).newPage();

  const base = baseFor(TENANT);
  await p.goto(`${base}/login`, { waitUntil: "networkidle" });
  await p.fill('input[name="username"]', "admin");
  await p.fill('input[name="password"]', PASSWORT);
  await Promise.all([p.waitForURL((u) => !u.pathname.includes("/login")), p.click('form button[type="submit"]')]);
  // Erprobungen sind ab Werk aus. Ohne Einschalten prüfte der Durchlauf nur die
  // Weiterleitung auf die Hinweisseite - und übersähe jeden Fehler dahinter.
  await p.goto(`${base}/admin/module`, { waitUntil: "networkidle" });
  for (const label of ["Schichtplan", "Fundsachen & Schlüssel", "Essensbestellung"]) {
    const schalter = p.getByRole("switch", { name: `${label} aktivieren` });
    if (await schalter.count()) {
      await schalter.first().click();
      await p
        .waitForResponse((antwort) => antwort.url().includes("/schichtplan") || antwort.request().method() === "POST", {
          timeout: 5000,
        })
        .catch(() => undefined);
      await p.waitForTimeout(1200);
    }
  }
  await p.goto(`${base}/admin/module`, { waitUntil: "networkidle" });
  const nochAus = await p.getByRole("switch", { name: /(Schichtplan|Fundsachen|Essensbestellung) aktivieren/ }).count();
  if (nochAus > 0) {
    console.log(`Hinweis: ${nochAus} Erprobung(en) ließen sich nicht einschalten`);
  }

  let bad = await pruefeRouten(p, base, ROUTES);

  // Zweiter Durchlauf: die Plattformverwaltung, eigener Mandant, eigener Login.
  await p.goto(`${baseFor(PLATFORM_TENANT)}/login`, { waitUntil: "networkidle" });
  await p.fill('input[name="username"]', "plattform");
  await p.fill('input[name="password"]', PASSWORT);
  await Promise.all([p.waitForURL((u) => !u.pathname.includes("/login")), p.click('form button[type="submit"]')]);
  bad += await pruefeRouten(p, baseFor(PLATFORM_TENANT), PLATFORM_ROUTES);

  const gesamt = ROUTES.length + PLATFORM_ROUTES.length;
  console.log(bad === 0 ? `\nAlle ${gesamt} Seiten laden fehlerfrei` : `\n${bad} Seiten fehlerhaft`);
  await b.close();
  process.exit(bad ? 1 : 0);
})();
