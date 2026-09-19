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
  let bad = 0;
  for (const route of ROUTES) {
    const r = await p.goto(BASE + route, { waitUntil: "networkidle" });
    const txt = await p.locator("body").innerText();
    const broken =
      r.status() >= 400 || txt.includes("Da ist etwas schiefgelaufen") || txt.includes("Seite nicht gefunden");
    if (broken) bad++;
    console.log(`${broken ? "FAIL" : "ok  "} ${r.status()} ${route}`);
  }
  console.log(bad === 0 ? `\nAlle ${ROUTES.length} Seiten laden fehlerfrei` : `\n${bad} Seiten fehlerhaft`);
  await b.close();
  process.exit(bad ? 1 : 0);
})();
