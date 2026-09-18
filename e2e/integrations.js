const { chromium } = require("playwright");
const { MODULE_DEFINITIONS } = require("../packages/shared/dist");
const TENANT = process.env.E2E_TENANT || "autohaus-mueller";
const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
const API = process.env.E2E_API_URL || "http://localhost:3001/api";
// Beide Module werden abgeschaltet ausgeliefert; diese Prüfungen setzen sie voraus.
const BENOETIGT = ["integrations", "stock"];
const results = [];
const check = (n, ok, d = "") => {
  results.push({ n, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " :: " + d : ""}`);
};

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const p = await (await b.newContext({ locale: "de-DE" })).newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  p.on("dialog", (d) => d.accept().catch(() => {}));

  try {
    await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await p.fill('input[name="username"]', "admin");
    await p.fill('input[name="tenant"]', TENANT);
    await p.fill('input[name="password"]', process.env.E2E_PASSWORD || "Intranet2026!");
    await Promise.all([p.waitForURL((u) => !u.pathname.includes("/login")), p.click('form button[type="submit"]')]);

    for (const key of BENOETIGT) {
      await p.context().request.put(`${API}/modules/${key}`, { data: { enabled: true } });
    }

    // Navigation
    await p.goto(`${BASE}/`, { waitUntil: "networkidle" });
    check("Fahrzeugbestand in der Navigation", (await p.locator('nav a[href="/fahrzeugbestand"]').count()) > 0);
    check("Schnittstellen in der Navigation", (await p.locator('nav a[href="/admin/schnittstellen"]').count()) > 0);

    // Übersicht
    await p.goto(`${BASE}/admin/schnittstellen`, { waitUntil: "networkidle" });
    const text = await p.locator("body").innerText();
    check("14 Konnektoren gelistet", text.includes("14"), "Kennzahl Konnektoren");
    check("Verfügbarkeitsklassen erklärt", text.includes("Partnervertrag erforderlich") && text.includes("Offene API"));
    check("RW.IL aufgeführt", text.includes("RW.IL"));
    check("VaudisX aufgeführt", text.includes("VaudisX"));
    check("Laufprotokoll sichtbar", text.includes("Laufprotokoll"));

    // Detailseite eines gesperrten Systems
    await p.goto(`${BASE}/admin/schnittstellen/vw_rwil`, { waitUntil: "networkidle" });
    const rwil = await p.locator("body").innerText();
    check("Gated-System nennt Voraussetzungen", rwil.includes("Voraussetzungen für die Inbetriebnahme"));
    check("Vorgang als nicht umgesetzt markiert", rwil.includes("wartet auf Spezifikation"));

    // mobile.de Detailseite + Abgleich
    await p.goto(`${BASE}/admin/schnittstellen/mobile_de`, { waitUntil: "networkidle" });
    const md = await p.locator("body").innerText();
    check("Offene API als umgesetzt markiert", md.includes("umgesetzt"));
    check("Passwortfeld nicht vorbefüllt", (await p.inputValue('input[name="secret:password"]')) === "");

    // Der Abgleich braucht echte Zugangsdaten (Sandbox oder Mock). Ohne sie
    // wird dieser Teil übersprungen statt fälschlich als Fehler gemeldet.
    const konfiguriert = md.includes("Ein Wert ist hinterlegt");
    if (!konfiguriert) {
      console.log("SKIP  Abgleich und Bestand - mobile.de ist nicht konfiguriert (siehe e2e/README.md)");
    } else {
      check("Hinweis auf hinterlegten Wert", true);

      await p.goto(`${BASE}/admin/schnittstellen`, { waitUntil: "networkidle" });
      await p.locator('button:has-text("Inserate in den Bestand übernehmen")').first().click();
      await p.waitForTimeout(6000);
      check("Abgleich meldet Ergebnis", (await p.locator("body").innerText()).includes("Inserat"));

      // Bestand
      await p.goto(`${BASE}/fahrzeugbestand`, { waitUntil: "networkidle" });
      const stock = await p.locator("body").innerText();
      check("Bestand zeigt mobile.de-Fahrzeug", stock.includes("ID.4"));
      check("Bestand zeigt DMS-Fahrzeug", stock.includes("Octavia"));
      check("Preis in Euro formatiert", /38\.990\s*€/.test(stock) || stock.includes("38.990"));
    }

    // Modulabhängigkeit: Schnittstellen aus -> Bestand aus
    await p.goto(`${BASE}/admin/module`, { waitUntil: "networkidle" });
    await p.locator('button[role="switch"][aria-label*="Schnittstellen"]').first().click();
    await p.waitForTimeout(3500);
    check(
      "Fahrzeugbestand folgt Schnittstellen in die Deaktivierung",
      (await p.locator('button[role="switch"][aria-label="Fahrzeugbestand aktivieren"]').count()) > 0,
    );
    await p.goto(`${BASE}/fahrzeugbestand`, { waitUntil: "networkidle" });
    check("Bestandsseite gesperrt", p.url().includes("/modul-deaktiviert"), p.url());

    await p.goto(`${BASE}/admin/module`, { waitUntil: "networkidle" });
    await p.click('main button:has-text("Auf Standard zurücksetzen")');
    await p.waitForTimeout(4000);
    // Zurücksetzen heißt Auslieferungszustand, nicht "alles an": Schnittstellen
    // und Fahrzeugbestand gehören zu den Modulen, die ausgeschaltet ausgeliefert
    // werden. Maßstab ist die Registry.
    const standardmaessigAus = MODULE_DEFINITIONS.filter((m) => !m.core && !m.defaultEnabled).length;
    const aus = await p.locator('button[role="switch"][aria-checked="false"]').count();
    check(
      "Zurücksetzen stellt den Auslieferungszustand her",
      aus === standardmaessigAus,
      `${aus} aus, erwartet ${standardmaessigAus}`,
    );

    check("Keine JavaScript-Fehler", errors.length === 0, errors.slice(0, 2).join(" | "));
  } catch (e) {
    check("Durchlauf ohne Abbruch", false, String(e).slice(0, 250));
  } finally {
    // Auslieferungszustand wiederherstellen, damit ein Folgelauf dieselbe
    // Ausgangslage vorfindet wie ein frisch aufgesetztes System.
    for (const key of [...BENOETIGT].reverse()) {
      await p.context().request.put(`${API}/modules/${key}`, { data: { enabled: false } });
    }
    await b.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} Prüfungen bestanden`);
  process.exit(failed.length ? 1 : 0);
})();
