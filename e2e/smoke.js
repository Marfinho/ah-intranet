const { chromium } = require("playwright");
const TENANT = process.env.E2E_TENANT || "autohaus-mueller";
const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
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
  "/admin/mandanten",
  "/admin/datenschutz",
];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const p = await (await b.newContext({ locale: "de-DE" })).newPage();
  await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await p.fill('input[name="username"]', "admin");
  await p.fill('input[name="tenant"]', TENANT);
  await p.fill('input[name="password"]', "Intranet2026!");
  await Promise.all([p.waitForURL((u) => !u.pathname.includes("/login")), p.click('form button[type="submit"]')]);
  // Erprobungen sind ab Werk aus. Ohne Einschalten prüfte der Durchlauf nur die
  // Weiterleitung auf die Hinweisseite - und übersähe jeden Fehler dahinter.
  await p.goto(`${BASE}/admin/module`, { waitUntil: "networkidle" });
  for (const label of ["Schichtplan", "Fundsachen & Schlüssel", "Essensbestellung"]) {
    const schalter = p.getByRole("switch", { name: `${label} aktivieren` });
    if (await schalter.count()) {
      await schalter.first().click();
      await p.waitForResponse((antwort) => antwort.url().includes("/schichtplan") || antwort.request().method() === "POST", {
        timeout: 5000,
      }).catch(() => undefined);
      await p.waitForTimeout(1200);
    }
  }
  await p.goto(`${BASE}/admin/module`, { waitUntil: "networkidle" });
  const nochAus = await p.getByRole("switch", { name: /(Schichtplan|Fundsachen|Essensbestellung) aktivieren/ }).count();
  if (nochAus > 0) {
    console.log(`Hinweis: ${nochAus} Erprobung(en) ließen sich nicht einschalten`);
  }

  let bad = 0;
  for (const route of ROUTES) {
    const r = await p.goto(BASE + route, { waitUntil: "networkidle" });
    const txt = await p.locator("body").innerText();
    const broken =
      r.status() >= 400 ||
      txt.includes("Da ist etwas schiefgelaufen") ||
      txt.includes("Seite nicht gefunden") ||
      // Eine stille Weiterleitung auf die Hinweisseite ist kein geladenes Modul.
      p.url().includes("/modul-deaktiviert");
    if (broken) bad++;
    console.log(`${broken ? "FAIL" : "ok  "} ${r.status()} ${route}`);
  }
  console.log(bad === 0 ? `\nAlle ${ROUTES.length} Seiten laden fehlerfrei` : `\n${bad} Seiten fehlerhaft`);
  await b.close();
  process.exit(bad ? 1 : 0);
})();
