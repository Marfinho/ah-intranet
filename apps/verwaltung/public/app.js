import { el, tooltipAktivieren } from "./bausteine.js";
import { seiten } from "./seiten.js";
import { api, setzeIch } from "./sitzung.js";

/* Schlanker Rahmen: Anmeldung, Navigation, Router. Kein Framework - die Verwaltung hat ein Dutzend Ansichten. */

const wurzel = document.getElementById("app");
const NAV = [
  ["#/", "Übersicht"],
  ["#/haeuser", "Häuser"],
  ["#/interessenten", "Interessenten"],
  ["#/statistik", "Statistik"],
  ["#/system", "System"],
  ["#/protokoll", "Protokoll"],
];
let ich = null;

async function start() {
  tooltipAktivieren();
  try {
    ich = await api("/auth/ich");
    setzeIch(ich);
  } catch {
    return zeigeAnmeldung();
  }
  if (!ich.mfaEingerichtet) return zeigeMfaEinrichtung();
  window.addEventListener("hashchange", zeichne);
  zeichne();
}

/* -------------------------------------------------------- Anmeldung */
function anmeldeRahmen(...inhalt) {
  wurzel.replaceChildren(
    el(
      "div",
      { class: "login" },
      el(
        "div",
        { class: "marke", style: "color:var(--schrift)" },
        el("img", { src: "/signet.svg", alt: "" }),
        "AHOI ",
        el("small", {}, "Verwaltung"),
      ),
      el("div", { class: "karte" }, inhalt),
    ),
  );
}

function formular(felder, knopf, beiAbsenden) {
  const fehler = el("div", { class: "fehler", hidden: true, role: "alert" });
  const form = el(
    "form",
    {
      onsubmit: async (e) => {
        e.preventDefault();
        fehler.hidden = true;
        try {
          await beiAbsenden(Object.fromEntries(new FormData(form)));
        } catch (f) {
          fehler.textContent = f.message;
          fehler.hidden = false;
        }
      },
    },
    felder,
    fehler,
    el("button", { class: "primaer", type: "submit" }, knopf),
  );
  return form;
}

const feld = (name, text, typ = "text", extra = {}) =>
  el("label", {}, text, el("input", { name, type: typ, required: true, ...extra }));

function zeigeAnmeldung() {
  anmeldeRahmen(
    el("h1", {}, "Anmelden"),
    el("p", { class: "gedaempft" }, "Verwaltung der Autohäuser, Interessenten und des Systems."),
    formular(
      [
        feld("username", "Benutzername", "text", { autocomplete: "username", autofocus: true }),
        feld("passwort", "Passwort", "password", { autocomplete: "current-password" }),
      ],
      "Weiter",
      async (d) => {
        const antwort = await api("/auth/anmelden", { methode: "POST", daten: d });
        if (antwort.mfaErforderlich) return zeigeCode(antwort.zwischentoken);
        location.reload(); // Sitzung ohne zweiten Faktor: geht zur Einrichtung
      },
    ),
  );
}

function zeigeCode(zwischentoken) {
  anmeldeRahmen(
    el("h1", {}, "Zweiter Faktor"),
    el("p", { class: "gedaempft" }, "Sechsstelliger Code aus der Authenticator-App - oder ein Wiederherstellungscode."),
    formular(
      [feld("code", "Code", "text", { autocomplete: "one-time-code", inputmode: "text", autofocus: true })],
      "Anmelden",
      async (d) => {
        await api("/auth/code", { methode: "POST", daten: { zwischentoken, code: d.code } });
        location.hash = "#/";
        location.reload();
      },
    ),
  );
}

async function zeigeMfaEinrichtung() {
  anmeldeRahmen(el("h1", {}, "Zweiten Faktor einrichten"), el("p", { class: "leer" }, "Wird vorbereitet …"));
  let einrichtung;
  try {
    einrichtung = await api("/auth/mfa/beginnen", { methode: "POST" });
  } catch (f) {
    return anmeldeRahmen(el("h1", {}, "Zweiten Faktor einrichten"), el("div", { class: "fehler" }, f.message));
  }
  anmeldeRahmen(
    el("h1", {}, "Zweiten Faktor einrichten"),
    el(
      "p",
      { class: "gedaempft" },
      "Die Verwaltung greift auf alle Häuser zu und verlangt deshalb immer einen zweiten Faktor. Geheimnis in der Authenticator-App eintragen (Eingabe per Hand, Zeitbasiert):",
    ),
    el("p", {}, el("code", { class: "code" }, einrichtung.geheimnis)),
    el("p", { class: "leise" }, "Oder diese Adresse öffnen: ", el("a", { href: einrichtung.adresse }, "otpauth-Link")),
    formular(
      [feld("code", "Code aus der App", "text", { inputmode: "numeric", autocomplete: "one-time-code" })],
      "Bestätigen",
      async (d) => {
        const ergebnis = await api("/auth/mfa/bestaetigen", { methode: "POST", daten: { code: d.code } });
        anmeldeRahmen(
          el("h1", {}, "Eingerichtet"),
          el(
            "p",
            { class: "gedaempft" },
            "Diese Wiederherstellungscodes gelten je einmal und werden nicht noch einmal gezeigt. Sicher aufbewahren, getrennt vom Telefon.",
          ),
          el(
            "div",
            { class: "codes" },
            ergebnis.wiederherstellungscodes.map((c) => el("span", {}, c)),
          ),
          el("button", { class: "primaer", onclick: () => location.reload() }, "Weiter zur Anmeldung"),
        );
      },
    ),
  );
}

/* ---------------------------------------------------------- Rahmen */
async function zeichne() {
  const pfad = location.hash.replace(/^#/, "") || "/";
  const [, bereich = "", id] = pfad.split("/");
  const seite = seiten[bereich] ?? seiten[""];
  const inhalt = el("main", {}, el("p", { class: "leer" }, "Lädt …"));
  wurzel.replaceChildren(kopf(bereich), inhalt);
  try {
    inhalt.replaceChildren(...(await seite(id, { neuZeichnen: zeichne })).filter(Boolean));
  } catch (f) {
    if (f.status === 401) return location.reload();
    inhalt.replaceChildren(el("div", { class: "fehler", role: "alert" }, f.message));
  }
  document.title = `${document.querySelector("main h1")?.textContent ?? "Verwaltung"} · AHOI Verwaltung`;
}

function kopf(aktuell) {
  return el(
    "header",
    { class: "kopf" },
    el(
      "div",
      { class: "kopf-innen" },
      el("div", { class: "marke" }, el("img", { src: "/signet.svg", alt: "" }), "AHOI ", el("small", {}, "Verwaltung")),
      el(
        "nav",
        { "aria-label": "Hauptnavigation" },
        NAV.map(([href, text]) =>
          el(
            "a",
            { href, "aria-current": (href === "#/" ? aktuell === "" : href.slice(2) === aktuell) ? "page" : null },
            text,
          ),
        ),
      ),
      el(
        "div",
        { class: "konto" },
        el("span", {}, ich.displayName, ich.rolle === "inhaber" ? "" : " (lesend)"),
        el("button", { onclick: passwortDialog }, "Passwort"),
        el(
          "button",
          {
            onclick: async () => {
              await api("/auth/abmelden", { methode: "POST" });
              location.hash = "#/";
              location.reload();
            },
          },
          "Abmelden",
        ),
      ),
    ),
  );
}

function passwortDialog() {
  const aktuell = prompt("Aktuelles Passwort:");
  if (!aktuell) return;
  const neu = prompt("Neues Passwort (mindestens 12 Zeichen):");
  if (!neu) return;
  api("/auth/passwort", { methode: "POST", daten: { aktuell, neu } }).then(
    () => {
      alert("Passwort geändert. Bitte erneut anmelden.");
      location.reload();
    },
    (f) => alert(f.message),
  );
}

start();
