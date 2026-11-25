/* Kleine Bausteine: DOM-Hilfen, Formatierung und Diagramme. Alles ohne Fremdbibliothek. */

/** Erzeugt ein Element. Text wird nie als HTML gesetzt - Kundennamen sind fremde Eingaben. */
export function el(tag, attribute = {}, ...kinder) {
  const knoten = tag.startsWith("svg:")
    ? document.createElementNS("http://www.w3.org/2000/svg", tag.slice(4))
    : document.createElement(tag);
  for (const [name, wert] of Object.entries(attribute ?? {})) {
    if (wert === null || wert === undefined || wert === false) continue;
    if (name.startsWith("on")) knoten.addEventListener(name.slice(2), wert);
    else if (name === "class") knoten.setAttribute("class", wert);
    else if (name === "tip") knoten.dataset.tip = wert;
    // Über das Objektmodell statt als Attribut: so genügt eine Richtlinie ohne `unsafe-inline`.
    else if (name === "style") knoten.style.cssText = wert;
    else knoten.setAttribute(name, wert === true ? "" : wert);
  }
  for (const kind of kinder.flat(Infinity)) {
    if (kind === null || kind === undefined || kind === false) continue;
    knoten.append(kind instanceof Node ? kind : document.createTextNode(String(kind)));
  }
  return knoten;
}

const zahlFormat = new Intl.NumberFormat("de-DE");
export const zahl = (wert) => (wert === null || wert === undefined ? "–" : zahlFormat.format(wert));
export const prozent = (wert) => (wert === null || wert === undefined ? "–" : `${String(wert).replace(".", ",")} %`);
export const euro = (cent) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format((cent ?? 0) / 100);
export const datum = (wert) => (wert ? new Date(wert).toLocaleDateString("de-DE") : "–");
export const zeit = (wert) =>
  wert ? new Date(wert).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) : "–";

/** „vor 3 Tagen“ - der Betreiber fragt meist, wie lange etwas her ist, nicht wann. */
export function vor(wert) {
  if (!wert) return "nie";
  const sekunden = (Date.now() - new Date(wert).getTime()) / 1000;
  if (sekunden < 90) return "gerade eben";
  const einheiten = [
    [60, "Minute", "Minuten"],
    [3600, "Stunde", "Stunden"],
    [86400, "Tag", "Tagen"],
    [2592000, "Monat", "Monaten"],
    [31536000, "Jahr", "Jahren"],
  ];
  let wahl = einheiten[0];
  for (const einheit of einheiten) if (sekunden >= einheit[0]) wahl = einheit;
  const n = Math.floor(sekunden / wahl[0]);
  return `vor ${n} ${n === 1 ? wahl[1] : wahl[2]}`;
}

export function dauer(sekunden) {
  const tage = Math.floor(sekunden / 86400),
    std = Math.floor((sekunden % 86400) / 3600),
    min = Math.floor((sekunden % 3600) / 60);
  return tage > 0 ? `${tage} T. ${std} Std.` : std > 0 ? `${std} Std. ${min} Min.` : `${min} Min.`;
}

/** Zustand immer mit Wort, nie nur Farbe (docs/ci.md). */
export const zustand = (text, art = "neutral") => el("span", { class: `marke-zustand z-${art}` }, text);

/* -------------------------------------------------------------- Tooltip */
export function tooltipAktivieren() {
  const tip = document.getElementById("tip");
  const zeige = (ereignis) => {
    const ziel = ereignis.target.closest?.("[data-tip]");
    if (!ziel) {
      tip.hidden = true;
      return;
    }
    tip.textContent = ziel.dataset.tip;
    tip.hidden = false;
    const breite = tip.offsetWidth;
    tip.style.left = `${Math.min(ereignis.clientX + 14, window.innerWidth - breite - 8)}px`;
    tip.style.top = `${ereignis.clientY + 16}px`;
  };
  document.addEventListener("pointermove", zeige);
  document.addEventListener("pointerleave", () => (tip.hidden = true));
  document.addEventListener("focusin", (e) => {
    const z = e.target.closest?.("[data-tip]");
    if (z) {
      const r = z.getBoundingClientRect();
      tip.textContent = z.dataset.tip;
      tip.hidden = false;
      tip.style.left = `${r.left}px`;
      tip.style.top = `${r.bottom + 6}px`;
    }
  });
  document.addEventListener("focusout", () => (tip.hidden = true));
}

/* ---------------------------------------------------------- Diagramme */

/** Waagerechte Balken mit Beschriftung links und Zahl rechts: für Vergleiche mit Namen. */
export function balken(zeilen, { einheit = (n) => zahl(n), max, ton } = {}) {
  const spitze = max ?? Math.max(1, ...zeilen.map((z) => z.wert));
  if (zeilen.length === 0) return el("p", { class: "leer" }, "Noch keine Daten.");
  return el(
    "div",
    { class: "balkenliste" },
    zeilen.map((z) =>
      el(
        "div",
        { class: "balkenzeile", tip: z.tip ?? `${z.name}: ${einheit(z.wert)}` },
        el("span", { class: "name" }, z.href ? el("a", { href: z.href }, z.name) : z.name),
        el(
          "div",
          { class: "balkenspur" },
          el("div", {
            class: `balken ${z.ton ?? ton ?? ""}`,
            style: `width:${Math.max(0, Math.min(100, (z.wert / spitze) * 100))}%`,
          }),
        ),
        el("span", { class: "wert" }, z.anzeige ?? einheit(z.wert)),
      ),
    ),
  );
}

/**
 * Säulen über der Zeit. Dünn, nur wenige Achsenmarken, Werte erst beim Zeigen.
 * `reihe`: [{ name, wert }]
 */
export function saeulen(reihe, { hoehe = 150, marken = 5, einheit = zahl } = {}) {
  if (reihe.length === 0) return el("p", { class: "leer" }, "Noch keine Daten.");
  const breite = 640,
    oben = 8,
    unten = 22,
    links = 34;
  const spitze = Math.max(1, ...reihe.map((r) => r.wert));
  const schritt = (breite - links) / reihe.length;
  const w = Math.max(2, Math.min(18, schritt - 2));
  const y = (wert) => oben + (hoehe - oben - unten) * (1 - wert / spitze);
  const svg = el("svg:svg", {
    class: "diagramm",
    viewBox: `0 0 ${breite} ${hoehe}`,
    role: "img",
    "aria-label": "Säulendiagramm",
  });
  for (const teil of [0, 0.5, 1]) {
    svg.append(el("svg:line", { class: "gitter", x1: links, x2: breite, y1: y(spitze * teil), y2: y(spitze * teil) }));
    svg.append(
      el(
        "svg:text",
        { x: links - 6, y: y(spitze * teil) + 4, "text-anchor": "end" },
        einheit(Math.round(spitze * teil)),
      ),
    );
  }
  reihe.forEach((r, i) => {
    const x = links + i * schritt + (schritt - w) / 2;
    const h = Math.max(r.wert > 0 ? 2 : 0, hoehe - unten - y(r.wert));
    svg.append(
      el("svg:rect", {
        class: `saeule${r.akzent ? " akzent" : ""}`,
        x,
        y: hoehe - unten - h,
        width: w,
        height: h,
        rx: Math.min(4, w / 2),
        "data-tip": `${r.name}: ${einheit(r.wert)}`,
      }),
    );
    // Unsichtbare, breitere Trefferfläche: die Säule allein ist zu schmal zum Treffen.
    svg.append(
      el("svg:rect", {
        x: links + i * schritt,
        y: oben,
        width: schritt,
        height: hoehe - oben - unten,
        fill: "transparent",
        "data-tip": `${r.name}: ${einheit(r.wert)}`,
      }),
    );
  });
  const schrittMarke = Math.max(1, Math.ceil(reihe.length / marken));
  reihe.forEach((r, i) => {
    if (i % schrittMarke === 0)
      svg.append(
        el(
          "svg:text",
          { x: links + i * schritt + schritt / 2, y: hoehe - 6, "text-anchor": "middle" },
          r.marke ?? r.name,
        ),
      );
  });
  return svg;
}

/** Linie mit Fläche, ein Wert je Zeitpunkt; Fadenkreuz-Tooltip über unsichtbare Streifen. */
export function linie(reihe, { hoehe = 150, einheit = zahl } = {}) {
  if (reihe.length < 2) return el("p", { class: "leer" }, "Ein Verlauf entsteht ab dem zweiten festgehaltenen Tag.");
  const breite = 640,
    oben = 10,
    unten = 22,
    links = 34;
  const spitze = Math.max(1, ...reihe.map((r) => r.wert));
  const x = (i) => links + (i / (reihe.length - 1)) * (breite - links - 8);
  const y = (wert) => oben + (hoehe - oben - unten) * (1 - wert / spitze);
  const punkte = reihe.map((r, i) => `${x(i)},${y(r.wert)}`);
  const svg = el("svg:svg", {
    class: "diagramm",
    viewBox: `0 0 ${breite} ${hoehe}`,
    role: "img",
    "aria-label": "Liniendiagramm",
  });
  for (const teil of [0, 0.5, 1]) {
    svg.append(el("svg:line", { class: "gitter", x1: links, x2: breite, y1: y(spitze * teil), y2: y(spitze * teil) }));
    svg.append(
      el(
        "svg:text",
        { x: links - 6, y: y(spitze * teil) + 4, "text-anchor": "end" },
        einheit(Math.round(spitze * teil)),
      ),
    );
  }
  svg.append(
    el("svg:polygon", {
      class: "flaeche",
      points: `${x(0)},${y(0)} ${punkte.join(" ")} ${x(reihe.length - 1)},${y(0)}`,
    }),
  );
  svg.append(el("svg:polyline", { class: "linie", points: punkte.join(" ") }));
  const letzte = reihe.length - 1;
  svg.append(el("svg:circle", { class: "punkt", cx: x(letzte), cy: y(reihe[letzte].wert), r: 4 }));
  svg.append(el("svg:text", { x: links, y: hoehe - 6 }, reihe[0].name));
  svg.append(el("svg:text", { x: breite - 8, y: hoehe - 6, "text-anchor": "end" }, reihe[letzte].name));
  const streifen = (breite - links) / reihe.length;
  reihe.forEach((r, i) =>
    svg.append(
      el("svg:rect", {
        x: x(i) - streifen / 2,
        y: oben,
        width: streifen,
        height: hoehe - oben - unten,
        fill: "transparent",
        "data-tip": `${r.name}: ${einheit(r.wert)}`,
      }),
    ),
  );
  return svg;
}

/** Tabelle, in der ein Klick auf die Kopfzeile sortiert. */
export function tabelle(spalten, zeilen, { beiKlick, leer = "Keine Einträge." } = {}) {
  const zustandSort = { spalte: null, aufsteigend: true };
  const huelle = el("div", { class: "tabelle-huelle" });
  const zeichne = () => {
    let daten = [...zeilen];
    const sp = spalten.find((s) => s.name === zustandSort.spalte);
    if (sp?.sort)
      daten.sort((a, b) => {
        const x = sp.sort(a),
          y = sp.sort(b);
        const r =
          x === y
            ? 0
            : x === null || x === undefined
              ? 1
              : y === null || y === undefined
                ? -1
                : typeof x === "string"
                  ? x.localeCompare(y, "de")
                  : x - y;
        return zustandSort.aufsteigend ? r : -r;
      });
    huelle.replaceChildren(
      daten.length === 0
        ? el("p", { class: "leer" }, leer)
        : el(
            "table",
            {},
            el(
              "thead",
              {},
              el(
                "tr",
                {},
                spalten.map((s) =>
                  el(
                    "th",
                    {
                      class: `${s.zahl ? "zahl " : ""}${s.sort ? "sort" : ""}`,
                      "aria-sort":
                        zustandSort.spalte === s.name ? (zustandSort.aufsteigend ? "ascending" : "descending") : null,
                      onclick: s.sort
                        ? () => {
                            zustandSort.aufsteigend = zustandSort.spalte === s.name ? !zustandSort.aufsteigend : true;
                            zustandSort.spalte = s.name;
                            zeichne();
                          }
                        : null,
                    },
                    s.name,
                    zustandSort.spalte === s.name ? (zustandSort.aufsteigend ? " ▲" : " ▼") : "",
                  ),
                ),
              ),
            ),
            el(
              "tbody",
              {},
              daten.map((z) =>
                el(
                  "tr",
                  { class: beiKlick ? "klick" : "", onclick: beiKlick ? () => beiKlick(z) : null },
                  spalten.map((s) => el("td", { class: s.zahl ? "zahl" : "" }, s.zelle(z))),
                ),
              ),
            ),
          ),
    );
  };
  zeichne();
  return huelle;
}
