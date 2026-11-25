import {
  balken,
  datum,
  dauer,
  el,
  euro,
  linie,
  prozent,
  saeulen,
  tabelle,
  vor,
  zahl,
  zeit,
  zustand,
} from "./bausteine.js";
import { api, darfSchreiben } from "./sitzung.js";

const STATUS = {
  entwurf: "Entwurf",
  versendet: "Versendet",
  angefragt: "Angefragt",
  gewonnen: "Gewonnen",
  verloren: "Verloren",
};
const STATUS_TON = {
  entwurf: "neutral",
  versendet: "neutral",
  angefragt: "warn",
  gewonnen: "gut",
  verloren: "schlecht",
};
const GRUPPEN = {
  arbeitsplatz: "Arbeitsplatz",
  kommunikation: "Kommunikation",
  prozesse: "Prozesse",
  ressourcen: "Ressourcen",
  verwaltung: "Verwaltung",
};
const STUFE_TON = { kritisch: "schlecht", warnung: "warn", info: "neutral" };

const kopf = (titel, untertitel, ...rechts) =>
  el(
    "div",
    { class: "seitenkopf" },
    el("div", {}, el("h1", {}, titel), untertitel && el("p", {}, untertitel)),
    el("div", { class: "leiste" }, rechts),
  );
const karte = (titel, ...inhalt) => el("section", { class: "karte" }, titel && el("h2", {}, titel), inhalt);
const kachel = (etikett, wert, hilfe, extra) =>
  el(
    "div",
    { class: "karte kachel" },
    el("div", { class: "etikett" }, etikett),
    el("div", { class: "zahl" }, wert),
    hilfe && el("div", { class: "hilfe" }, hilfe),
    extra,
  );
const schluessel = (paare) =>
  el(
    "dl",
    { class: "schluessel" },
    paare.flatMap(([k, w]) => [el("dt", {}, k), el("dd", {}, w ?? "–")]),
  );

function hinweisListe(hinweise) {
  if (hinweise.length === 0) return el("p", { class: "leer" }, "Nichts, was Aufmerksamkeit braucht.");
  return el(
    "div",
    {},
    hinweise.map((h) => {
      const ziel = h.haus ? `#/haeuser/${h.haus.id}` : `#/interessenten/${h.interessent.id}`;
      return el(
        "div",
        { class: "hinweis" },
        zustand({ kritisch: "dringend", warnung: "Hinweis", info: "Info" }[h.stufe], STUFE_TON[h.stufe]),
        el("a", { href: ziel }, (h.haus ?? h.interessent).name),
        el("span", { class: "gedaempft" }, h.text),
      );
    }),
  );
}

function aenderung(dieseWoche, vorWoche) {
  if (!vorWoche) return null;
  const diff = Math.round(((dieseWoche - vorWoche) / vorWoche) * 100);
  return el("span", { class: "delta" }, `${diff >= 0 ? "▲" : "▼"} ${Math.abs(diff)} % zur Vorwoche`);
}

/** Schaltfläche, die nur Inhabern erscheint und vor dem Absenden nachfragt. */
async function aendere(beschreibung, aufruf, neuZeichnen, nachfrage) {
  if (nachfrage && !confirm(nachfrage)) return;
  try {
    await aufruf();
    await neuZeichnen();
  } catch (f) {
    alert(`${beschreibung} fehlgeschlagen: ${f.message}`);
  }
}

export const seiten = {
  /* ============================================================= Übersicht */
  async ""() {
    const u = await api("/uebersicht");
    const lizenzTon = u.lizenzen.auslastung !== null && u.lizenzen.auslastung >= 90 ? "warn" : "";
    return [
      kopf("Übersicht", "Der Stand aller Häuser und Interessenten auf einen Blick."),
      el(
        "div",
        { class: "raster" },
        kachel("Häuser", zahl(u.haeuser.aktiv), `${u.haeuser.gesperrt} gesperrt · ${u.haeuser.neu30} neu in 30 Tagen`),
        kachel(
          "Aktive Konten",
          zahl(u.konten.aktiv),
          `${prozent(u.konten.anteilAktiv30)} davon in 30 Tagen angemeldet`,
        ),
        kachel(
          "Lizenzen belegt",
          prozent(u.lizenzen.auslastung),
          `${zahl(u.lizenzen.belegt)} von ${zahl(u.lizenzen.vergeben)} · ${u.lizenzen.haeuserOhneLimit} Häuser unbegrenzt`,
        ),
        kachel("Zweiter Faktor", prozent(u.konten.mfaAnteil), `${zahl(u.konten.mitMfa)} Konten in Kundenhäusern`),
        kachel("Standorte", zahl(u.standorte), "in allen aktiven Häusern"),
        kachel(
          "Aktionen diese Woche",
          zahl(u.aktionen.dieseWoche),
          aenderung(u.aktionen.dieseWoche, u.aktionen.vorWoche) ?? "Einträge im Audit-Log der Häuser",
        ),
        kachel(
          "Offene Interessenten",
          zahl(
            u.interessenten.trichter
              .filter((s) => ["entwurf", "versendet", "angefragt"].includes(s.status))
              .reduce((a, s) => a + s.anzahl, 0),
          ),
          `${euro(u.interessenten.offenesVolumenCent)} je Monat in der Pipeline`,
        ),
        kachel(
          "Abschlussquote",
          prozent(u.interessenten.abschlussquote),
          `${euro(u.interessenten.gewonnenesVolumenCent)} je Monat gewonnen`,
        ),
      ),
      el(
        "div",
        { class: "raster-2" },
        karte(`Hinweise (${u.hinweise.length})`, hinweisListe(u.hinweise)),
        karte(
          "Vertriebstrichter",
          balken(
            u.interessenten.trichter.map((s) => ({
              name: STATUS[s.status],
              wert: s.anzahl,
              ton: s.status === "gewonnen" ? "" : s.status === "verloren" ? "schlecht" : "",
              tip: `${STATUS[s.status]}: ${s.anzahl} · ${euro(s.monatlichCent)} je Monat`,
              href: "#/interessenten",
            })),
          ),
        ),
        karte(
          "Aktivste Häuser (30 Tage)",
          balken(
            u.aktivste.map((h) => ({ name: h.name, wert: h.aktionen30, href: `#/haeuser/${h.id}` })),
            { ton: "akzent" },
          ),
        ),
        karte(
          "Lizenzauslastung",
          u.lizenzen.vergeben === 0
            ? el("p", { class: "leer" }, "Noch kein Haus mit Lizenzkontingent.")
            : balken(
                [{ name: "Belegt", wert: u.lizenzen.belegt, ton: lizenzTon, anzeige: prozent(u.lizenzen.auslastung) }],
                { max: u.lizenzen.vergeben },
              ),
        ),
      ),
    ];
  },

  /* ================================================================= Häuser */
  async haeuser(id, ctx) {
    return id ? hausDetail(id, ctx) : hausListe();
  },

  /* ========================================================== Interessenten */
  async interessenten(id, ctx) {
    return id ? leadDetail(id, ctx) : leadListe();
  },

  /* ============================================================== Statistik */
  async statistik() {
    const [s, verlauf] = await Promise.all([api("/statistik"), api("/statistik/verlauf")]);
    const gesamt = () => Object.values(s.anmeldungen).reduce((a, b) => a + b, 0) || 1;
    const anmeldeName = {
      heute: "heute",
      woche: "diese Woche",
      monat: "diesen Monat",
      aelter: "länger her",
      nie: "noch nie",
    };
    const statusName = {
      draft: "Entwurf",
      submitted: "Eingereicht",
      approved: "Genehmigt",
      rejected: "Abgelehnt",
      queued_for_bulk_order: "Sammelbestellung",
      ordered: "Bestellt",
      completed: "Abgeschlossen",
      cancelled: "Storniert",
      offen: "Offen",
      in_bearbeitung: "In Bearbeitung",
      wartet_auf_rueckmeldung: "Wartet auf Rückmeldung",
      geloest: "Gelöst",
    };
    return [
      kopf(
        "Statistik",
        "Auswertungen über alle Kundenhäuser. Nur Zählwerte - Inhalte und Personen sieht die Verwaltung nicht.",
        darfSchreiben() &&
          el(
            "button",
            {
              onclick: async (e) => {
                e.target.disabled = true;
                try {
                  await api("/statistik/schnappschuss", { methode: "POST" });
                  location.reload();
                } catch (f) {
                  alert(f.message);
                  e.target.disabled = false;
                }
              },
            },
            "Heutigen Stand festhalten",
          ),
      ),
      karte(
        "Aktivität (Einträge im Audit-Log, 90 Tage)",
        saeulen(
          s.aktivitaet.map((t) => ({
            name: datum(t.tag),
            marke: new Date(t.tag).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }),
            wert: t.n,
          })),
          { marken: 8 },
        ),
      ),
      el(
        "div",
        { class: "raster-2" },
        karte(
          "Neue Konten je Monat",
          saeulen(
            s.neueKonten.map((m) => ({ name: m.monat, marke: m.monat.slice(5), wert: m.n })),
            { marken: 12 },
          ),
        ),
        karte(
          "Letzte Anmeldung der aktiven Konten",
          balken(
            ["heute", "woche", "monat", "aelter", "nie"].map((k) => ({
              name: anmeldeName[k],
              wert: s.anmeldungen[k],
              tip: `${anmeldeName[k]}: ${zahl(s.anmeldungen[k])} Konten (${prozent(Math.round((s.anmeldungen[k] / gesamt()) * 1000) / 10)})`,
              ton: k === "nie" || k === "aelter" ? "warn" : "",
            })),
          ),
        ),
        karte(
          "Häufigste Aktionen (30 Tage)",
          balken(
            s.aktionsarten.map((a) => ({ name: a.art, wert: a.n })),
            { ton: "akzent" },
          ),
        ),
        karte(
          "Größe der Häuser (aktive Konten)",
          balken(
            s.hausgroessen.map((g) => ({
              name: g.klasse,
              wert: g.n,
              anzeige: `${g.n} ${g.n === 1 ? "Haus" : "Häuser"}`,
            })),
          ),
        ),
      ),
      karte(
        "Nutzung nach Bereich",
        tabelle(
          [
            { name: "Bereich", zelle: (z) => z.label, sort: (z) => z.label },
            { name: "Datensätze gesamt", zahl: true, zelle: (z) => zahl(z.gesamt), sort: (z) => z.gesamt },
            { name: "Neu in 30 Tagen", zahl: true, zelle: (z) => zahl(z.monat), sort: (z) => z.monat },
          ],
          s.nutzung,
        ),
      ),
      el(
        "div",
        { class: "raster-2" },
        karte(
          "Verbreitung der Module (Häuser, die sie eingeschaltet haben)",
          balken(
            s.modulVerbreitung.map((m) => ({
              name: m.stage === "beta" ? `${m.label} (Erprobung)` : m.label,
              wert: m.haeuser,
              anzeige: `${m.haeuser} · ${prozent(m.anteil)}`,
            })),
            {
              max: Math.max(
                1,
                s.hausgroessen.reduce((a, g) => a + g.n, 0),
              ),
            },
          ),
        ),
        el(
          "div",
          { style: "display:grid;gap:1.25rem;align-content:start" },
          karte(
            "Bestellungen",
            balken(s.bestellungen.nachStatus.map((b) => ({ name: statusName[b.status] ?? b.status, wert: b.n }))),
            el(
              "p",
              { class: "gedaempft" },
              `Durchlaufzeit abgeschlossener Bestellungen im Schnitt: ${s.bestellungen.durchlaufTage === null ? "–" : `${String(s.bestellungen.durchlaufTage).replace(".", ",")} Tage`}`,
            ),
          ),
          karte(
            "Tickets",
            balken(s.tickets.nachStatus.map((b) => ({ name: statusName[b.status] ?? b.status, wert: b.n }))),
            el(
              "p",
              { class: "gedaempft" },
              `Lösungsquote ${prozent(s.tickets.loesungsquote)} · gelöst nach durchschnittlich ${s.tickets.loesungsStunden === null ? "–" : `${String(s.tickets.loesungsStunden).replace(".", ",")} Std.`}`,
            ),
          ),
          karte(
            "Sicherheit",
            schluessel([
              [
                "Häuser mit Pflicht zum zweiten Faktor",
                `${s.sicherheit.mfaPflichtHaeuser} von ${s.sicherheit.haeuser}`,
              ],
              ["Anmeldung über Entra ID aktiv", s.sicherheit.anbieter.find((a) => a.kind === "entra")?.n ?? 0],
            ]),
          ),
        ),
      ),
      el(
        "div",
        { class: "raster-2" },
        karte("Verlauf: aktive Konten", linie(verlauf.map((v) => ({ name: datum(v.tag), wert: v.konten })))),
        karte("Verlauf: belegte Lizenzen", linie(verlauf.map((v) => ({ name: datum(v.tag), wert: v.lizenzBelegt })))),
        karte("Verlauf: Häuser", linie(verlauf.map((v) => ({ name: datum(v.tag), wert: v.haeuser })))),
        karte("Verlauf: Aktionen je 7 Tage", linie(verlauf.map((v) => ({ name: datum(v.tag), wert: v.aktionen7 })))),
      ),
      el(
        "p",
        { class: "leise" },
        "Verläufe entstehen aus täglich festgehaltenen Ständen (Cron: ",
        el("code", {}, "pnpm --filter verwaltung schnappschuss"),
        ") - was die Häuser nicht selbst historisieren, lässt sich sonst nicht rekonstruieren.",
      ),
    ];
  },

  /* ================================================================= System */
  async system() {
    const s = await api("/system");
    const d = s.datenbank;
    const api2 = s.kundenApi;
    const ok = (wert) => zustand(wert ? "ok" : "gestört", wert ? "gut" : "schlecht");
    return [
      kopf("System", `Stand ${zeit(s.erzeugtAm)}`, el("button", { onclick: () => location.reload() }, "Aktualisieren")),
      el(
        "div",
        { class: "raster" },
        kachel(
          "Kunden-API",
          !api2.konfiguriert ? "–" : api2.ok ? "ok" : "gestört",
          !api2.konfiguriert
            ? "INTRANET_API_URL nicht gesetzt"
            : api2.erreichbar
              ? `Antwort in ${api2.antwortMs} ms · läuft seit ${dauer(api2.laufzeitSekunden ?? 0)}`
              : `Nicht erreichbar (${api2.fehler})`,
        ),
        kachel(
          "Datenbank",
          d.fehler ? "gestört" : `${zahl(d.groesseMb)} MB`,
          d.fehler ??
            `${d.verbindungen.gesamt} von ${d.verbindungen.maximal} Verbindungen · Zwischenspeicher ${prozent(d.zwischenspeicherTreffer)}`,
        ),
        kachel(
          "Sicherung",
          !s.sicherung.konfiguriert
            ? "–"
            : s.sicherung.neueste
              ? `vor ${s.sicherung.neueste.alterStunden} Std.`
              : "keine",
          !s.sicherung.konfiguriert
            ? "SICHERUNG_VERZEICHNIS nicht eingebunden"
            : s.sicherung.neueste
              ? `${s.sicherung.neueste.name} · ${s.sicherung.neueste.groesseMb} MB · ${s.sicherung.anzahl} Dateien`
              : (s.sicherung.fehler ?? "Verzeichnis leer"),
        ),
        kachel(
          "Verwaltung läuft seit",
          dauer(s.prozess.laufzeitSekunden),
          `Node ${s.prozess.node} · ${s.prozess.umgebung}`,
        ),
      ),
      el(
        "div",
        { class: "raster-2" },
        karte(
          "Prozess der Verwaltung",
          schluessel([
            ["Plattform", s.prozess.plattform],
            ["Prozesskennung", s.prozess.pid],
            ["Arbeitsspeicher (RSS)", `${s.prozess.speicherMb.rss} MB`],
            ["Heap", `${s.prozess.speicherMb.heap} von ${s.prozess.speicherMb.heapGesamt} MB`],
          ]),
        ),
        karte(
          "Server",
          schluessel([
            ["Rechnername", s.server.hostname],
            ["Prozessorkerne", s.server.kerne],
            ["Last (1/5/15 Min.)", s.server.last.join(" · ")],
            [
              "Arbeitsspeicher frei",
              `${zahl(Math.round(s.server.arbeitsspeicherMb.frei))} von ${zahl(Math.round(s.server.arbeitsspeicherMb.gesamt))} MB`,
            ],
            ["Läuft seit", dauer(s.server.laufzeitSekunden)],
          ]),
        ),
        karte(
          "Datenbank der Häuser",
          d.fehler
            ? el("div", { class: "fehler" }, d.fehler)
            : schluessel([
                ["Version", d.version],
                ["Datenbank", d.datenbank],
                ["Größe", `${d.groesseMb} MB`],
                ["Läuft seit", zeit(d.gestartet)],
                [
                  "Verbindungen aktiv / offen / maximal",
                  `${d.verbindungen.aktiv} / ${d.verbindungen.gesamt} / ${d.verbindungen.maximal}`,
                ],
                ["Treffer im Zwischenspeicher", prozent(d.zwischenspeicherTreffer)],
                ["Transaktionen", `${zahl(d.transaktionen)} (${zahl(d.zurueckgerollt)} zurückgerollt)`],
                ["Deadlocks", zahl(d.deadlocks)],
              ]),
        ),
        karte(
          "Migrationen",
          schluessel([
            [
              "Datenbank der Häuser",
              s.migrationen.haeuser
                ? `${s.migrationen.haeuser.anzahl} · zuletzt ${s.migrationen.haeuser.zuletzt} (${datum(s.migrationen.haeuser.wann)})`
                : "nicht lesbar",
            ],
            [
              "Eigene Daten der Verwaltung",
              s.migrationen.verwaltung
                ? `${s.migrationen.verwaltung.anzahl} · zuletzt ${s.migrationen.verwaltung.zuletzt}`
                : "nicht lesbar",
            ],
          ]),
        ),
        karte(
          "Konfiguration (ohne Geheimnisse)",
          schluessel(
            s.konfiguration.map((k) => [
              k.name,
              typeof k.wert === "boolean" ? ok(k.wert) : (k.wert ?? el("span", { class: "leise" }, "nicht gesetzt")),
            ]),
          ),
        ),
        karte(
          "Registries des Produkts",
          schluessel([
            [
              "Module",
              `${s.register.module.gesamt} (${s.register.module.stabil} stabil, ${s.register.module.erprobung} in Erprobung, ${s.register.module.kern} Kern)`,
            ],
            ["Rechte im Katalog", s.register.rechte],
            ["Grundrollen", s.register.grundrollen.join(", ")],
            ["Aufbewahrungsregeln", s.register.aufbewahrungsregeln],
            ["Preisliste", s.register.preislisteVersion],
            ["Pakete", s.register.tiers.join(", ")],
          ]),
        ),
      ),
      karte(
        "Größte Tabellen",
        tabelle(
          [
            { name: "Tabelle", zelle: (z) => z.name, sort: (z) => z.name },
            { name: "Zeilen", zahl: true, zelle: (z) => zahl(z.zeilen), sort: (z) => z.zeilen },
            {
              name: "Größe (MB)",
              zahl: true,
              zelle: (z) => String(z.groesseMb).replace(".", ","),
              sort: (z) => z.groesseMb,
            },
          ],
          s.tabellen,
        ),
      ),
    ];
  },

  /* ============================================================== Protokoll */
  async protokoll() {
    const suche = el("input", { type: "search", placeholder: "Suchen …", "aria-label": "Protokoll durchsuchen" });
    const huelle = el("div");
    const laden = async () => {
      const zeilen = await api(`/protokoll${suche.value ? `?suche=${encodeURIComponent(suche.value)}` : ""}`);
      huelle.replaceChildren(
        tabelle(
          [
            { name: "Zeit", zelle: (z) => zeit(z.createdAt), sort: (z) => z.createdAt },
            { name: "Wer", zelle: (z) => z.betreiberName, sort: (z) => z.betreiberName },
            { name: "Aktion", zelle: (z) => el("code", {}, z.aktion), sort: (z) => z.aktion },
            { name: "Was", zelle: (z) => z.detail },
          ],
          zeilen,
          { leer: "Keine Einträge." },
        ),
      );
    };
    let timer;
    suche.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(laden, 250);
    });
    await laden();
    return [
      kopf(
        "Protokoll",
        "Was in der Verwaltung geändert wurde - getrennt vom Audit-Log der Häuser. Die letzten 200 Einträge.",
      ),
      karte(null, el("div", { class: "leiste", style: "margin-bottom:.8rem" }, suche), huelle),
    ];
  },
};

/* ------------------------------------------------------------ Häuser */
async function hausListe() {
  const haeuser = await api("/haeuser");
  const suche = el("input", { type: "search", placeholder: "Haus suchen …", "aria-label": "Haus suchen" });
  const filter = el(
    "select",
    { "aria-label": "Zustand" },
    el("option", { value: "" }, "Alle"),
    el("option", { value: "aktiv" }, "Aktiv"),
    el("option", { value: "gesperrt" }, "Gesperrt"),
    el("option", { value: "hinweis" }, "Mit Hinweisen"),
  );
  const huelle = el("div");
  const zeichne = () => {
    const q = suche.value.trim().toLowerCase();
    const liste = haeuser.filter(
      (h) =>
        (!q || `${h.name} ${h.slug} ${h.domain ?? ""}`.toLowerCase().includes(q)) &&
        (filter.value === "" ||
          (filter.value === "aktiv" ? h.isActive : filter.value === "gesperrt" ? !h.isActive : h.hinweise.length > 0)),
    );
    huelle.replaceChildren(
      tabelle(
        [
          {
            name: "Haus",
            zelle: (h) => el("div", {}, el("strong", {}, h.name), el("div", { class: "leise" }, h.domain ?? h.slug)),
            sort: (h) => h.name,
          },
          {
            name: "Zustand",
            zelle: (h) =>
              !h.isActive
                ? zustand("gesperrt", "schlecht")
                : h.hinweise.some((x) => x.stufe === "kritisch")
                  ? zustand("dringend", "schlecht")
                  : h.hinweise.length
                    ? zustand("Hinweis", "warn")
                    : zustand("aktiv", "gut"),
            sort: (h) => (h.isActive ? 1 : 0),
          },
          {
            name: "Konten",
            zahl: true,
            zelle: (h) => (h.licensedSeats === null ? `${h.aktiveKonten}` : `${h.aktiveKonten} / ${h.licensedSeats}`),
            sort: (h) => h.aktiveKonten,
          },
          { name: "Lizenz", zahl: true, zelle: (h) => prozent(h.lizenzAuslastung), sort: (h) => h.lizenzAuslastung },
          {
            name: "Standorte",
            zahl: true,
            zelle: (h) => (h.locationLimit === null ? h.standorte : `${h.standorte} / ${h.locationLimit}`),
            sort: (h) => h.standorte,
          },
          { name: "Zweiter Faktor", zahl: true, zelle: (h) => prozent(h.mfaAnteil), sort: (h) => h.mfaAnteil },
          { name: "Aktionen 7 T.", zahl: true, zelle: (h) => zahl(h.aktionen7), sort: (h) => h.aktionen7 },
          {
            name: "Letzte Anmeldung",
            zelle: (h) => vor(h.letzteAnmeldung),
            sort: (h) => (h.letzteAnmeldung ? new Date(h.letzteAnmeldung).getTime() : 0),
          },
          { name: "Module", zahl: true, zelle: (h) => zahl(h.aktiveModule.length), sort: (h) => h.aktiveModule.length },
        ],
        liste,
        { beiKlick: (h) => (location.hash = `#/haeuser/${h.id}`), leer: "Kein Haus gefunden." },
      ),
    );
  };
  suche.addEventListener("input", zeichne);
  filter.addEventListener("change", zeichne);
  zeichne();
  return [
    kopf("Häuser", `${haeuser.length} Kundenhäuser`),
    karte(null, el("div", { class: "leiste", style: "margin-bottom:.8rem" }, suche, filter), huelle),
  ];
}

async function hausDetail(id, { neuZeichnen }) {
  const h = await api(`/haeuser/${id}`);
  const schreiben = darfSchreiben();
  const grenze = (name, aktuell, pfad, feldname) =>
    el(
      "div",
      { class: "leiste" },
      el("span", {}, aktuell ?? "unbegrenzt"),
      schreiben &&
        el(
          "button",
          {
            onclick: () => {
              const eingabe = prompt(`${name} (leer = unbegrenzt):`, aktuell ?? "");
              if (eingabe === null) return;
              const n = eingabe.trim() === "" ? null : Number(eingabe);
              if (n !== null && (!Number.isInteger(n) || n < 1)) return alert("Bitte eine ganze Zahl ab 1 eingeben.");
              aendere(
                name,
                () => api(`/haeuser/${id}/${pfad}`, { methode: "PATCH", daten: { [feldname]: n } }),
                neuZeichnen,
              );
            },
          },
          "Ändern",
        ),
    );
  const nachGruppe = Object.keys(GRUPPEN).map((g) => [g, h.module.filter((m) => m.group === g)]);
  const nutzungMax = Math.max(1, ...h.nutzung.map((n) => n.gesamt));
  return [
    el("p", {}, el("a", { href: "#/haeuser" }, "← Alle Häuser")),
    kopf(
      h.name,
      `${h.slug}${h.domain ? ` · ${h.domain}` : ""} · angelegt ${datum(h.createdAt)}`,
      h.isActive ? zustand("aktiv", "gut") : zustand("gesperrt", "schlecht"),
      schreiben &&
        (h.isActive
          ? el(
              "button",
              {
                class: "gefahr",
                onclick: () =>
                  aendere(
                    "Sperren",
                    () => api(`/haeuser/${id}/aktiv`, { methode: "PATCH", daten: { isActive: false } }),
                    neuZeichnen,
                    `${h.name} sperren? Niemand aus diesem Haus kann sich danach anmelden (Daten bleiben erhalten).`,
                  ),
              },
              "Haus sperren",
            )
          : el(
              "button",
              {
                class: "primaer",
                onclick: () =>
                  aendere(
                    "Freischalten",
                    () => api(`/haeuser/${id}/aktiv`, { methode: "PATCH", daten: { isActive: true } }),
                    neuZeichnen,
                  ),
              },
              "Haus freischalten",
            )),
    ),
    h.hinweise.length > 0 && karte("Hinweise", hinweisListe(h.hinweise)),
    el(
      "div",
      { class: "raster" },
      kachel("Aktive Konten", zahl(h.aktiveKonten), `${zahl(h.konten)} insgesamt`),
      kachel(
        "Lizenz",
        prozent(h.lizenzAuslastung),
        h.licensedSeats === null ? "kein Kontingent" : `${h.aktiveKonten} von ${h.licensedSeats}`,
      ),
      kachel("Standorte", zahl(h.standorte), h.locationLimit === null ? "kein Limit" : `Limit ${h.locationLimit}`),
      kachel("Zweiter Faktor", prozent(h.mfaAnteil), h.mfaPflicht ? "Pflicht im Haus" : "keine Pflicht"),
      kachel("Aktionen 30 Tage", zahl(h.aktionen30), `${zahl(h.aktionen7)} in 7 Tagen`),
      kachel(
        "Letzte Anmeldung",
        vor(h.letzteAnmeldung),
        h.letzteAktivitaet ? `Letzte Aktion ${vor(h.letzteAktivitaet)}` : "Noch keine Aktion",
      ),
    ),
    karte(
      "Aktivität (60 Tage)",
      saeulen(
        h.aktivitaet.map((t) => ({
          name: datum(t.tag),
          marke: new Date(t.tag).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }),
          wert: t.n,
        })),
        { marken: 8 },
      ),
    ),
    el(
      "div",
      { class: "raster-2" },
      karte(
        "Anmeldungen der aktiven Konten",
        balken(
          [
            ["heute", "heute"],
            ["woche", "diese Woche"],
            ["monat", "diesen Monat"],
            ["aelter", "länger her"],
            ["nie", "noch nie"],
          ].map(([k, name]) => ({ name, wert: h.anmeldungen[k], ton: k === "nie" || k === "aelter" ? "warn" : "" })),
        ),
      ),
      karte(
        "Nutzung",
        balken(
          h.nutzung
            .filter((n) => n.gesamt > 0)
            .sort((a, b) => b.gesamt - a.gesamt)
            .map((n) => ({
              name: n.label,
              wert: n.gesamt,
              max: nutzungMax,
              anzeige: `${zahl(n.gesamt)} · ${zahl(n.monat)} neu`,
              tip: `${n.label}: ${n.gesamt} gesamt, ${n.monat} in 30 Tagen`,
            })),
          { max: nutzungMax, ton: "akzent" },
        ),
      ),
      karte(
        "Vertrag und Grenzen",
        schluessel([
          ["Lizenzkontingent (Konten)", grenze("Lizenzkontingent", h.licensedSeats, "lizenz", "licensedSeats")],
          ["Standortlimit", grenze("Standortlimit", h.locationLimit, "standortlimit", "locationLimit")],
          [
            "Anmeldearten",
            ["Passwort", ...h.anmeldearten.map((a) => `${a.kind}${a.enabled ? "" : " (nicht aktiv)"}`)].join(", "),
          ],
          ["Standorte", h.standortNamen.map((s) => s.name).join(", ") || "–"],
        ]),
      ),
      karte(
        "Notiz des Betreibers",
        (() => {
          const feld = el("textarea", { rows: 5, style: "width:100%", disabled: !schreiben }, h.notes ?? "");
          return el(
            "div",
            {},
            feld,
            schreiben &&
              el(
                "div",
                { class: "leiste", style: "margin-top:.5rem" },
                el(
                  "button",
                  {
                    onclick: () =>
                      aendere(
                        "Speichern",
                        () => api(`/haeuser/${id}/notiz`, { methode: "PATCH", daten: { notes: feld.value } }),
                        neuZeichnen,
                      ),
                  },
                  "Notiz speichern",
                ),
              ),
          );
        })(),
      ),
    ),
    karte(
      "Module",
      el(
        "p",
        { class: "gedaempft" },
        "Einschalten zieht benötigte Vormodule mit, Ausschalten nimmt abhängige mit. Erprobungen schaltet nur die Verwaltung frei.",
      ),
      nachGruppe
        .filter(([, ms]) => ms.length)
        .map(([g, ms]) =>
          el(
            "div",
            { class: "modulgruppe" },
            el("div", { class: "etikett" }, GRUPPEN[g]),
            ms.map((m) =>
              el(
                "div",
                { class: "modul" },
                el(
                  "span",
                  {},
                  m.label,
                  " ",
                  m.stage === "beta" && zustand("Erprobung", "warn"),
                  m.core && zustand("Kern", "neutral"),
                  m.geaendertVon && el("span", { class: "leise" }, ` · ${vor(m.geaendertAm)} von ${m.geaendertVon}`),
                ),
                m.core
                  ? zustand("immer an", "neutral")
                  : el(
                      "label",
                      { class: "schalter" },
                      el("input", {
                        type: "checkbox",
                        checked: m.enabled,
                        disabled: !schreiben,
                        onchange: (e) =>
                          aendere(
                            m.label,
                            () =>
                              api(`/haeuser/${id}/module/${m.key}`, {
                                methode: "PUT",
                                daten: { enabled: e.target.checked },
                              }),
                            neuZeichnen,
                          ),
                      }),
                      m.enabled ? "an" : "aus",
                    ),
              ),
            ),
          ),
        ),
    ),
  ];
}

/* ------------------------------------------------------ Interessenten */
async function leadListe() {
  const { liste, auswertung: a } = await api("/interessenten");
  const filter = el(
    "select",
    { "aria-label": "Status" },
    el("option", { value: "" }, "Alle Stände"),
    Object.entries(STATUS).map(([k, v]) => el("option", { value: k }, v)),
  );
  const huelle = el("div");
  const zeichne = () =>
    huelle.replaceChildren(
      tabelle(
        [
          {
            name: "Interessent",
            zelle: (l) =>
              el(
                "div",
                {},
                el("strong", {}, l.name),
                l.ansprechperson && el("div", { class: "leise" }, l.ansprechperson),
              ),
            sort: (l) => l.name,
          },
          { name: "Stand", zelle: (l) => zustand(STATUS[l.status], STATUS_TON[l.status]), sort: (l) => l.status },
          { name: "Häuser", zahl: true, zelle: (l) => l.anzahlHaeuser, sort: (l) => l.anzahlHaeuser },
          { name: "Nutzer", zahl: true, zelle: (l) => l.anzahlNutzer, sort: (l) => l.anzahlNutzer },
          { name: "Paket", zelle: (l) => l.tier ?? "Einzelwahl", sort: (l) => l.tier ?? "" },
          {
            name: "je Monat",
            zahl: true,
            zelle: (l) => (l.monatlichCent === null ? "–" : euro(l.monatlichCent)),
            sort: (l) => l.monatlichCent,
          },
          {
            name: "Angefragt",
            zelle: (l) => (l.angefragtAm ? vor(l.angefragtAm) : "–"),
            sort: (l) => (l.angefragtAm ? new Date(l.angefragtAm).getTime() : 0),
          },
          {
            name: "Link",
            zelle: (l) =>
              l.linkWiderrufen
                ? zustand("widerrufen", "schlecht")
                : new Date(l.tokenGueltigBis) < new Date()
                  ? zustand("abgelaufen", "warn")
                  : `bis ${datum(l.tokenGueltigBis)}`,
            sort: (l) => new Date(l.tokenGueltigBis).getTime(),
          },
        ],
        liste.filter((l) => !filter.value || l.status === filter.value),
        { beiKlick: (l) => (location.hash = `#/interessenten/${l.id}`), leer: "Keine Interessenten." },
      ),
    );
  filter.addEventListener("change", zeichne);
  zeichne();
  return [
    kopf(
      "Interessenten",
      `${liste.length} Einträge · Anlegen und Hausanlage laufen vorerst weiter in der Plattformverwaltung der Kunden-Anwendung`,
    ),
    el(
      "div",
      { class: "raster" },
      kachel("Pipeline offen", euro(a.offenesVolumenCent), "je Monat, Entwurf bis Anfrage"),
      kachel("Gewonnen", euro(a.gewonnenesVolumenCent), "je Monat"),
      kachel("Abschlussquote", prozent(a.abschlussquote), "gewonnen von entschieden"),
      kachel(
        "Bis zur Anfrage",
        a.tageBisAnfrage === null ? "–" : `${String(a.tageBisAnfrage).replace(".", ",")} T.`,
        "im Schnitt ab Anlage",
      ),
    ),
    el(
      "div",
      { class: "raster-2" },
      karte(
        "Trichter",
        balken(
          a.trichter.map((s) => ({
            name: STATUS[s.status],
            wert: s.anzahl,
            ton: s.status === "verloren" ? "schlecht" : s.status === "gewonnen" ? "" : "akzent",
            tip: `${STATUS[s.status]}: ${s.anzahl} · ${s.nutzer} Nutzer · ${euro(s.monatlichCent)} je Monat`,
          })),
        ),
      ),
      karte(
        "Gewünschte Pakete",
        balken(a.tiers.map((t) => ({ name: t.tier === "einzelwahl" ? "Einzelwahl" : t.tier, wert: t.anzahl }))),
      ),
    ),
    karte(null, el("div", { class: "leiste", style: "margin-bottom:.8rem" }, filter), huelle),
  ];
}

async function leadDetail(id, { neuZeichnen }) {
  const l = await api(`/interessenten/${id}`);
  const schreiben = darfSchreiben();
  const notiz = el("textarea", { rows: 5, style: "width:100%", disabled: !schreiben }, l.notiz ?? "");
  const status = el(
    "select",
    {
      disabled: !schreiben,
      "aria-label": "Stand",
      onchange: (e) =>
        aendere(
          "Stand ändern",
          () => api(`/interessenten/${id}/status`, { methode: "PATCH", daten: { status: e.target.value } }),
          neuZeichnen,
        ),
    },
    Object.entries(STATUS).map(([k, v]) => el("option", { value: k, selected: k === l.status }, v)),
  );
  return [
    el("p", {}, el("a", { href: "#/interessenten" }, "← Alle Interessenten")),
    kopf(
      l.name,
      l.ansprechperson ?? "Keine Ansprechperson hinterlegt",
      zustand(STATUS[l.status], STATUS_TON[l.status]),
      status,
    ),
    l.hinweise.length > 0 && karte("Hinweise", hinweisListe(l.hinweise)),
    el(
      "div",
      { class: "raster" },
      kachel("Häuser", zahl(l.anzahlHaeuser), `${l.standorte} Standorte erfasst`),
      kachel("Nutzer", zahl(l.anzahlNutzer), l.keyUser === null ? "Key-User offen" : `${l.keyUser} Key-User`),
      kachel("Paket", l.tier ?? "Einzelwahl", l.tier ? null : `${l.module.length} Module gewählt`),
      kachel(
        "Angebot je Monat",
        l.monatlichCent === null ? "–" : euro(l.monatlichCent),
        l.preislisteVersion
          ? `Preisliste ${l.preislisteVersion}${l.preislisteVersion !== l.aktuellePreisliste ? " (veraltet)" : ""}`
          : "noch keine Anfrage",
      ),
    ),
    el(
      "div",
      { class: "raster-2" },
      karte(
        "Verlauf",
        schluessel([
          ["Angelegt", `${datum(l.createdAt)} (${vor(l.createdAt)})`],
          ["Zuletzt geändert", vor(l.updatedAt)],
          ["Angefragt", l.angefragtAm ? `${zeit(l.angefragtAm)} (${vor(l.angefragtAm)})` : "noch nicht"],
          ["Link gültig bis", datum(l.tokenGueltigBis)],
          ["Link", l.linkWiderrufen ? zustand("widerrufen", "schlecht") : zustand("gültig", "gut")],
          ["Haus angelegt", l.hausId ? el("a", { href: `#/haeuser/${l.hausId}` }, "Zum Haus") : "nein"],
        ]),
        schreiben &&
          !l.linkWiderrufen &&
          el(
            "div",
            { class: "leiste", style: "margin-top:.8rem" },
            el(
              "button",
              {
                class: "gefahr",
                onclick: () =>
                  aendere(
                    "Widerrufen",
                    () => api(`/interessenten/${id}/link-widerrufen`, { methode: "POST" }),
                    neuZeichnen,
                    "Link widerrufen? Die Pitch-Seite ist danach nicht mehr erreichbar; ein neuer Link wird in der Kunden-Anwendung erzeugt.",
                  ),
              },
              "Link widerrufen",
            ),
          ),
      ),
      karte(
        "Notiz",
        notiz,
        schreiben &&
          el(
            "div",
            { class: "leiste", style: "margin-top:.5rem" },
            el(
              "button",
              {
                onclick: () =>
                  aendere(
                    "Speichern",
                    () => api(`/interessenten/${id}/notiz`, { methode: "PATCH", daten: { notiz: notiz.value } }),
                    neuZeichnen,
                  ),
              },
              "Notiz speichern",
            ),
          ),
      ),
    ),
    karte(
      "Häuser des Interessenten",
      tabelle(
        [
          { name: "Haus", zelle: (s) => s.name },
          { name: "Ort", zelle: (s) => [s.plz, s.ort].filter(Boolean).join(" ") || "–" },
          { name: "Marken", zelle: (s) => s.marken.join(", ") || "–" },
          { name: "Leistungen", zelle: (s) => s.leistungen.join(", ") || "–" },
          { name: "Verbund", zelle: (s) => s.campus ?? "–" },
        ],
        l.standortListe,
        { leer: "Noch keine Häuser erfasst." },
      ),
    ),
  ];
}
