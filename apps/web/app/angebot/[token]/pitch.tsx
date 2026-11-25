"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  HAEUSER_MAX,
  MODULE_DEFINITIONS,
  MODULE_GROUPS,
  MODULE_GROUP_LABELS,
  MODUL_NUTZEN,
  NUTZER_MAX,
  TIERS,
  berechneAngebot,
  einzelmodulPreis,
  formatEuro,
  getModule,
  waehlbareModule,
  type LeadKonfiguration,
  type ModuleDefinition,
  type PitchAnsicht,
  type TierKey,
} from "@ah-intranet/shared";
import { pitchAnfrageAction, pitchSpeichernAction } from "@/lib/actions";
import { ModulSlideshow } from "./modul-slideshow";

const STATIONEN = ["Start", "Ihre Häuser", "Funktionen", "Ihr Angebot", "Ihr Intranet"] as const;

const label = (key: string) => getModule(key)?.label ?? key;
const istBeta = (key: string) => getModule(key)?.stage === "beta";

export function Pitch({ token, ansicht }: { token: string; ansicht: PitchAnsicht }) {
  const [station, setStation] = useState(0);
  // Die Auswahl gehört der ganzen Seite: das Angebot ändert sie, das Sternbild zeigt sie.
  const [konf, setKonf] = useState<LeadKonfiguration>(ansicht.konfiguration);
  const gehe = (nummer: number) => {
    setStation(Math.max(0, Math.min(STATIONEN.length - 1, nummer)));
    window.scrollTo({ top: 0 });
  };

  useEffect(() => {
    const auf = (ereignis: KeyboardEvent) => {
      if (/INPUT|SELECT|TEXTAREA/.test((ereignis.target as HTMLElement).tagName)) return;
      // Bei offenem Fenster gehören die Pfeiltasten dem Fenster, nicht der Seite.
      if (document.querySelector('[role="dialog"]')) return;
      if (ereignis.key === "ArrowRight") setStation((s) => Math.min(STATIONEN.length - 1, s + 1));
      if (ereignis.key === "ArrowLeft") setStation((s) => Math.max(0, s - 1));
    };
    window.addEventListener("keydown", auf);
    return () => window.removeEventListener("keydown", auf);
  }, []);

  return (
    <div className="pitch">
      <header>
        <div className="wrap">
          <div className="bar">
            <div className="brand">
              {ansicht.name} <span>×</span> AHOI
            </div>
            <nav className="nav" aria-label="Stationen">
              {STATIONEN.map((name, index) => (
                <button key={name} type="button" aria-current={index === station} onClick={() => gehe(index)}>
                  {name}
                </button>
              ))}
            </nav>
          </div>
        </div>
        <div className="prog">
          <i style={{ width: `${((station + 1) / STATIONEN.length) * 100}%` }} />
        </div>
      </header>

      <main className="wrap">
        {station === 0 ? <Start ansicht={ansicht} /> : null}
        {station === 1 ? <Haeuser ansicht={ansicht} /> : null}
        {station === 2 ? <Funktionen ansicht={ansicht} /> : null}
        {station === 3 ? <Angebot token={token} ansicht={ansicht} konf={konf} setKonf={setKonf} /> : null}
        {station === 4 ? <Intranet ansicht={ansicht} konf={konf} onAngebot={() => gehe(3)} /> : null}

        <div className="pager">
          <button type="button" className="btn" disabled={station === 0} onClick={() => gehe(station - 1)}>
            Zurück
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={station === STATIONEN.length - 1}
            onClick={() => gehe(station + 1)}
          >
            Weiter
          </button>
        </div>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ Start */

function Start({ ansicht }: { ansicht: PitchAnsicht }) {
  const marken = useMemo(() => [...new Set(ansicht.standorte.flatMap((standort) => standort.marken))], [ansicht]);
  const verbuende = useMemo(() => {
    const zaehler = new Map<string, number>();
    for (const standort of ansicht.standorte) {
      if (standort.campus) zaehler.set(standort.campus, (zaehler.get(standort.campus) ?? 0) + 1);
    }
    return [...zaehler.values()].filter((anzahl) => anzahl > 1).length;
  }, [ansicht]);

  return (
    <section className="station" style={{ paddingTop: 56 }}>
      <div className="eyebrow">Vorschlag für {ansicht.name}</div>
      <h1 style={{ marginTop: 14 }}>{ansicht.standorte.length} Häuser. Ein Intranet.</h1>
      <p className="lead">
        Aushänge, Bestellungen, Freigaben, Anträge, Serviceanfragen, Einarbeitung: der Betriebsalltag aller Ihrer Häuser
        an einer Stelle. Das Autogeschäft bleibt im DMS, wo es hingehört. Diese Seite ist auf Ihre Standorte
        zugeschnitten. Stellen Sie ein, was Sie brauchen, und sehen Sie sofort, was es kostet.
      </p>
      <Namensherkunft />

      <div className="facts">
        <div className="fact">
          <b>{ansicht.standorte.length}</b>
          <span>Häuser, jedes mit eigenem Alltag</span>
        </div>
        <div className="fact">
          <b>{marken.length}</b>
          <span>Marken unter einem Dach</span>
        </div>
        {verbuende > 0 ? (
          <div className="fact">
            <b>{verbuende}</b>
            <span>{verbuende === 1 ? "Standortverbund" : "Standortverbünde"} mit gemeinsamer Nutzung</span>
          </div>
        ) : null}
        <div className="fact">
          <b>{MODULE_DEFINITIONS.length}</b>
          <span>Module, jedes einzeln zuschaltbar</span>
        </div>
      </div>
      <p className="hint" style={{ marginTop: 28 }}>
        Weiter mit der Schaltfläche, den Pfeiltasten oder den Reitern oben.
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------- Name */

type Buchstabe = "A" | "H" | "O" | "I";

const BUCHSTABEN: Record<Buchstabe, { wort: string; titel: string; text: string }> = {
  A: {
    wort: "Auto",
    titel: "Auto",
    text: "Das Autogeschäft selbst bleibt in Ihrem DMS. AHOI kümmert sich um alles, was drumherum im Betrieb passiert.",
  },
  H: {
    wort: "Haus",
    titel: "Haus",
    text: "Gebaut für Autohäuser mit mehreren Standorten, Marken und Abteilungen. Jede Person sieht, was für ihr Haus gilt.",
  },
  O: {
    wort: "Organisation",
    titel: "Organisation",
    text: "Bestellungen, Freigaben, Anträge, Serviceanfragen, Einarbeitung: der Betriebsalltag an einer Stelle.",
  },
  I: {
    wort: "Information",
    titel: "Information",
    text: "Aushänge, Wissen, Dokumente, Verzeichnis: jede Person erfährt, was für sie gilt.",
  },
};

/** Das Wort, aus dem der Name entsteht. Die Buchstaben des Namens tragen ihren Schlüssel. */
const NAMENSZEICHEN: { zeichen: string; buchstabe?: Buchstabe }[] = [
  ..."AUTOHAUS".split("").map((zeichen, index) => ({
    zeichen,
    buchstabe: index === 0 ? ("A" as const) : index === 4 ? ("H" as const) : undefined,
  })),
  { zeichen: "\u00A0" },
  ..."ORGANISATION"
    .split("")
    .map((zeichen, index) => ({ zeichen, buchstabe: index === 0 ? ("O" as const) : undefined })),
  { zeichen: "\u00A0" },
  { zeichen: "&" },
  { zeichen: "\u00A0" },
  ..."INFORMATION"
    .split("")
    .map((zeichen, index) => ({ zeichen, buchstabe: index === 0 ? ("I" as const) : undefined })),
];

/**
 * Woher der Name kommt: Autohaus Organisation & Information.
 *
 * Ein Regler zieht das Wort auf seine vier Buchstaben zusammen, bis AHOI übrig
 * bleibt. Der Name ist eine Abkürzung und kein Bild; das Zeichen daneben baut
 * sich aus seinen vier Feldern auf, drei gefüllt und eines offen.
 */
function Namensherkunft() {
  const [fortschritt, setFortschritt] = useState(0);
  const [angeheftet, setAngeheftet] = useState<Buchstabe | null>(null);
  const [schwebe, setSchwebe] = useState<Buchstabe | null>(null);
  const lauf = useRef<number | null>(null);
  const aktiv = schwebe ?? angeheftet;

  const stoppe = () => {
    if (lauf.current !== null) {
      cancelAnimationFrame(lauf.current);
      lauf.current = null;
    }
  };
  useEffect(() => stoppe, []);

  const spiele = () => {
    stoppe();
    const ziel = fortschritt >= 0.99 ? 0 : 1;
    const von = fortschritt;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setFortschritt(ziel);
      return;
    }
    const dauer = 2200;
    const start = performance.now();
    const schritt = (jetzt: number) => {
      const t = Math.min(1, (jetzt - start) / dauer);
      const weich = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      setFortschritt(von + (ziel - von) * weich);
      lauf.current = t < 1 ? requestAnimationFrame(schritt) : null;
    };
    lauf.current = requestAnimationFrame(schritt);
  };

  const fertig = fortschritt >= 0.99;
  const heftAn = (buchstabe: Buchstabe) => setAngeheftet((alt) => (alt === buchstabe ? null : buchstabe));

  return (
    <div className="name">
      <div className="name-kopf">
        <span className="eyebrow">Woher der Name kommt</span>
        <button type="button" className="btn" onClick={spiele}>
          {fertig ? "Zurück zum Wort" : "Zusammenziehen"}
        </button>
      </div>

      <div className="name-bild">
        <div
          className="name-wort"
          role="group"
          aria-label="Autohaus Organisation und Information, zusammengezogen zu AHOI"
        >
          {NAMENSZEICHEN.map((eintrag, index) =>
            eintrag.buchstabe ? (
              <button
                key={index}
                type="button"
                className={`n-key ${aktiv === eintrag.buchstabe ? "fokus" : ""}`}
                aria-label={`${eintrag.buchstabe}: ${BUCHSTABEN[eintrag.buchstabe].wort}`}
                onMouseEnter={() => setSchwebe(eintrag.buchstabe!)}
                onMouseLeave={() => setSchwebe(null)}
                onFocus={() => setSchwebe(eintrag.buchstabe!)}
                onBlur={() => setSchwebe(null)}
                onClick={() => heftAn(eintrag.buchstabe!)}
              >
                {eintrag.zeichen}
              </button>
            ) : (
              <span
                key={index}
                className="n-weg"
                aria-hidden="true"
                style={{ maxWidth: `${(1 - fortschritt) * 1.2}em`, opacity: Math.max(0, 1 - fortschritt * 1.7) }}
              >
                {eintrag.zeichen}
              </span>
            ),
          )}
        </div>

        <svg
          className="name-zeichen"
          viewBox="0 0 76 76"
          role="img"
          aria-label="Das AHOI-Zeichen: vier Felder, drei gefüllt, eines offen"
        >
          {[
            { x: 0, y: 0, offen: false },
            { x: 40, y: 0, offen: true },
            { x: 0, y: 40, offen: false },
            { x: 40, y: 40, offen: false },
          ].map((feld, index) => {
            const sichtbar = Math.max(0, Math.min(1, (fortschritt - (0.45 + index * 0.1)) / 0.12));
            return feld.offen ? (
              <rect
                key={index}
                className="z-offen"
                x={feld.x + 2}
                y={feld.y + 2}
                width="32"
                height="32"
                opacity={sichtbar}
              />
            ) : (
              <rect key={index} className="z-voll" x={feld.x} y={feld.y} width="36" height="36" opacity={sichtbar} />
            );
          })}
        </svg>
      </div>

      <label className="name-regler">
        <span>Vom Wort zum Namen</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(fortschritt * 100)}
          onChange={(e) => {
            stoppe();
            setFortschritt(Number(e.target.value) / 100);
          }}
        />
      </label>

      <div className="name-karten" role="group" aria-label="Die vier Buchstaben">
        {(Object.keys(BUCHSTABEN) as Buchstabe[]).map((buchstabe) => (
          <button
            key={buchstabe}
            type="button"
            className="name-karte"
            aria-pressed={aktiv === buchstabe}
            onMouseEnter={() => setSchwebe(buchstabe)}
            onMouseLeave={() => setSchwebe(null)}
            onFocus={() => setSchwebe(buchstabe)}
            onBlur={() => setSchwebe(null)}
            onClick={() => heftAn(buchstabe)}
          >
            <span className="name-buchstabe">{buchstabe}</span>
            <b>{BUCHSTABEN[buchstabe].titel}</b>
            <span>{BUCHSTABEN[buchstabe].text}</span>
          </button>
        ))}
      </div>

      <p className="hint" style={{ marginTop: 12 }}>
        AHOI ist eine Abkürzung, kein Bild. Das Zeichen zeigt vier Felder, drei gefüllt und eines offen: die Module, die
        ein Haus einschaltet, und das eine, das es nicht braucht.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ Häuser */

function Haeuser({ ansicht }: { ansicht: PitchAnsicht }) {
  const [gewaehlt, setGewaehlt] = useState(0);
  const haus = ansicht.standorte[gewaehlt];

  return (
    <section className="station">
      <div className="eyebrow">Ihre Standorte</div>
      <h2 style={{ marginTop: 10 }}>Jedes Haus hat einen anderen Alltag</h2>
      <p className="lead">
        Wählen Sie ein Haus. Die Vorschläge zeigen, wo AHOI dort ansetzen könnte. Sie beruhen auf den Angaben, die uns
        vorliegen, und gehören im Gespräch mit Ihnen geprüft.
      </p>
      <div className="cols" style={{ marginTop: 24 }}>
        <div className="grid">
          {ansicht.standorte.map((standort, index) => (
            <button
              key={`${standort.name}-${index}`}
              type="button"
              className="card"
              aria-pressed={index === gewaehlt}
              onClick={() => setGewaehlt(index)}
            >
              <b>{standort.name}</b>
              <small>{standort.marken.join(" · ") || "–"}</small>
            </button>
          ))}
        </div>
        {haus ? (
          <aside className="panel detail" aria-live="polite">
            <div className="row">
              {haus.leistungen.map((leistung) => (
                <span key={leistung} className="pill p-mute">
                  {leistung}
                </span>
              ))}
              {haus.campus ? <span className="pill p-acc">Verbund {haus.campus}</span> : null}
            </div>
            <h3>{haus.name}</h3>
            <dl>
              {haus.adresse ? (
                <>
                  <dt>Adresse</dt>
                  <dd>{haus.adresse}</dd>
                </>
              ) : null}
              {haus.marken.length > 0 ? (
                <>
                  <dt>Marke</dt>
                  <dd>{haus.marken.join(", ")}</dd>
                </>
              ) : null}
              {haus.oeffnungszeiten ? (
                <>
                  <dt>Verkauf</dt>
                  <dd>{haus.oeffnungszeiten}</dd>
                </>
              ) : null}
            </dl>
            <div className="fit">
              <span className="eyebrow">Vorschlag für dieses Haus</span>
              <p style={{ margin: "8px 0", color: "var(--muted)" }}>{haus.vorschlagText}</p>
              <div className="row">
                {haus.vorschlagModule.map((key) => (
                  <span key={key} className="pill p-acc">
                    {label(key)}
                    {istBeta(key) ? " (Beta)" : ""}
                  </span>
                ))}
              </div>
            </div>
          </aside>
        ) : null}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- Funktionen */

function Funktionen({ ansicht }: { ansicht: PitchAnsicht }) {
  const [gruppe, setGruppe] = useState<string>("alle");
  const [gewaehlt, setGewaehlt] = useState<string>("news");
  const [ablauf, setAblauf] = useState<string | null>(null);
  const module = (MODULE_DEFINITIONS as readonly ModuleDefinition[]).filter(
    (modul) => gruppe === "alle" || modul.group === gruppe,
  );
  const aktuell = getModule(gewaehlt);
  const tiers = TIERS.filter((tier) => tier.module.includes(gewaehlt));
  const preis = einzelmodulPreis(gewaehlt);
  const wählbar = waehlbareModule().some((modul) => modul.key === gewaehlt);
  const vorgeschlagen = new Set(ansicht.standorte.flatMap((standort) => standort.vorschlagModule));

  return (
    <section className="station">
      <div className="eyebrow">Funktionsumfang</div>
      <h2 style={{ marginTop: 10 }}>{MODULE_DEFINITIONS.length} Module, Sie schalten ein, was Sie brauchen</h2>
      <p className="lead">
        Wählen Sie ein Modul, um zu sehen, was es tut und in welchem Paket es steckt. Markiert sind die Module, die wir
        für Ihre Häuser vorgeschlagen haben.
      </p>
      <div className="chips" role="group" aria-label="Bereich">
        {[["alle", "Alle"], ...Object.entries(MODULE_GROUP_LABELS)].map(([key, name]) => (
          <button key={key} type="button" className="chip" aria-pressed={gruppe === key} onClick={() => setGruppe(key)}>
            {name}
          </button>
        ))}
      </div>
      <div className="cols">
        <div className="grid">
          {module.map((modul) => (
            <button
              key={modul.key}
              type="button"
              className="card"
              aria-pressed={modul.key === gewaehlt}
              onClick={() => setGewaehlt(modul.key)}
            >
              <b>{modul.label}</b>
              <div className="row">
                {modul.core ? <span className="pill p-mute">Kern</span> : null}
                {modul.stage === "beta" ? <span className="pill p-acc">Beta</span> : null}
                {vorgeschlagen.has(modul.key) ? <span className="pill p-ok">Für Sie vorgeschlagen</span> : null}
              </div>
            </button>
          ))}
        </div>
        {aktuell ? (
          <aside className="panel detail" aria-live="polite">
            <div className="row">
              <span className="pill p-mute">{MODULE_GROUP_LABELS[aktuell.group]}</span>
              {aktuell.stage === "beta" ? (
                <span className="pill p-acc">Beta</span>
              ) : (
                <span className="pill p-ok">Stabil</span>
              )}
            </div>
            <h3>{aktuell.label}</h3>
            <p style={{ margin: 0, color: "var(--muted)" }}>{aktuell.description}</p>
            <dl>
              <dt>Enthalten in</dt>
              <dd>{tiers.map((tier) => tier.name).join(", ")}</dd>
              <dt>Einzeln</dt>
              <dd>
                {aktuell.core
                  ? "Kernmodul, immer enthalten"
                  : wählbar
                    ? `${formatEuro(preis.grundCent)} im Monat plus ${formatEuro(preis.nutzerCent)} je Nutzer`
                    : "Erprobung: nur im Paket Komplett, nach Freischaltung"}
              </dd>
              {aktuell.dependsOn.length > 0 ? (
                <>
                  <dt>Braucht</dt>
                  <dd>{aktuell.dependsOn.map((key) => label(key)).join(", ")}</dd>
                </>
              ) : null}
            </dl>
            <button
              type="button"
              className="btn primary"
              style={{ marginTop: 16 }}
              onClick={() => setAblauf(aktuell.key)}
            >
              Ablauf ansehen
            </button>
          </aside>
        ) : null}
      </div>
      {ablauf ? <ModulSlideshow schluessel={ablauf} onClose={() => setAblauf(null)} /> : null}
    </section>
  );
}

/* ----------------------------------------------------------------- Angebot */

type Speicherstand = "bereit" | "speichert" | "gespeichert" | "fehler";

function Angebot({
  token,
  ansicht,
  konf,
  setKonf,
}: {
  token: string;
  ansicht: PitchAnsicht;
  konf: LeadKonfiguration;
  setKonf: (aktualisiere: (alt: LeadKonfiguration) => LeadKonfiguration) => void;
}) {
  const [stand, setStand] = useState<Speicherstand>("bereit");
  const [angefragt, setAngefragt] = useState(ansicht.angefragt);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, starte] = useTransition();
  const erster = useRef(true);

  const angebot = useMemo(
    () =>
      berechneAngebot({
        haeuser: konf.haeuser,
        nutzer: konf.nutzer,
        keyUser: konf.keyUser,
        tier: konf.tier as TierKey | null,
        module: konf.module,
      }),
    [konf],
  );

  // Die Auswahl bleibt erhalten, wenn jemand die Seite später noch einmal öffnet.
  useEffect(() => {
    if (erster.current) {
      erster.current = false;
      return;
    }
    setStand("speichert");
    const timer = setTimeout(async () => {
      const ergebnis = await pitchSpeichernAction(token, konf);
      setStand(ergebnis.ok ? "gespeichert" : "fehler");
    }, 700);
    return () => clearTimeout(timer);
  }, [konf, token]);

  const aendere = (teil: Partial<LeadKonfiguration>) => setKonf((alt) => ({ ...alt, ...teil }));
  const zahl = (wert: string, min: number, max: number) =>
    Math.min(max, Math.max(min, Math.floor(Number(wert) || min)));

  const waehleTier = (tier: TierKey) => aendere({ tier });
  const waehleAuswahl = () => {
    if (konf.tier === null) return;
    const aktuellesTier = TIERS.find((eintrag) => eintrag.key === konf.tier);
    const start = waehlbareModule()
      .map((modul) => modul.key as string)
      .filter((key) => aktuellesTier?.module.includes(key));
    aendere({ tier: null, module: start });
  };
  const schalte = (key: string) => {
    const hat = angebot.module.includes(key);
    aendere({ module: hat ? konf.module.filter((eintrag) => eintrag !== key) : [...konf.module, key] });
  };

  const anfragen = () => {
    setFehler(null);
    starte(async () => {
      const ergebnis = await pitchAnfrageAction(token, konf);
      if (ergebnis.ok) setAngefragt(true);
      else setFehler(ergebnis.message ?? "Die Anfrage konnte nicht gesendet werden.");
    });
  };

  const stufe = konf.tier === null;

  return (
    <section className="station">
      <div className="eyebrow">Ihr Angebot</div>
      <h2 style={{ marginTop: 10 }}>Stellen Sie sich Ihr Intranet zusammen</h2>
      <p className="lead">
        Alle Preise netto. Ein Paket ist günstiger als dieselben Module einzeln. Ihre Auswahl wird gespeichert, Sie
        können jederzeit zurückkommen.
      </p>

      <div className="inputs">
        <div className="field">
          <label htmlFor="haeuser">Häuser</label>
          <input
            id="haeuser"
            type="number"
            min={1}
            max={HAEUSER_MAX}
            value={konf.haeuser}
            onChange={(e) => aendere({ haeuser: zahl(e.target.value, 1, HAEUSER_MAX) })}
          />
        </div>
        <div className="field">
          <label htmlFor="nutzer">Nutzer mit eigenem Zugang</label>
          <input
            id="nutzer"
            type="number"
            min={1}
            max={NUTZER_MAX}
            value={konf.nutzer}
            onChange={(e) => aendere({ nutzer: zahl(e.target.value, 1, NUTZER_MAX) })}
          />
          <input
            type="range"
            min={1}
            max={1000}
            value={Math.min(konf.nutzer, 1000)}
            aria-label="Nutzer einstellen"
            onChange={(e) => aendere({ nutzer: zahl(e.target.value, 1, 1000) })}
          />
        </div>
        <div className="field">
          <label htmlFor="keyuser">Zu schulende Key-User</label>
          <input
            id="keyuser"
            type="number"
            min={1}
            max={NUTZER_MAX}
            value={angebot.keyUser}
            onChange={(e) => aendere({ keyUser: zahl(e.target.value, 1, NUTZER_MAX) })}
          />
        </div>
      </div>

      <div className="tiers" role="group" aria-label="Paket wählen">
        {TIERS.map((tier) => {
          const rechnung = berechneAngebot({
            haeuser: konf.haeuser,
            nutzer: konf.nutzer,
            keyUser: konf.keyUser,
            tier: tier.key,
          });
          return (
            <button
              key={tier.key}
              type="button"
              className="tier"
              aria-pressed={konf.tier === tier.key}
              onClick={() => waehleTier(tier.key)}
            >
              <h3>{tier.name}</h3>
              <div className="preis">
                {formatEuro(rechnung.monatlich.summeCent)} <small>im Monat</small>
              </div>
              <p>{tier.beschreibung}</p>
              <p>
                <b>{tier.module.length}</b> von {MODULE_DEFINITIONS.length} Modulen
              </p>
              {rechnung.ersparnisCent > 0 ? (
                <span className="spar">{formatEuro(rechnung.ersparnisCent)} günstiger als einzeln</span>
              ) : null}
            </button>
          );
        })}
        <button type="button" className="tier" aria-pressed={stufe} onClick={waehleAuswahl}>
          <h3>Eigene Auswahl</h3>
          <div className="preis">
            {stufe ? formatEuro(angebot.monatlich.summeCent) : "Einzeln"} <small>{stufe ? "im Monat" : "wählen"}</small>
          </div>
          <p>Nur die Module, die Sie wirklich brauchen. Jedes mit eigenem Preis.</p>
        </button>
      </div>

      {stufe ? (
        <>
          <div className="auswahl">
            {waehlbareModule().map((modul) => {
              const an = angebot.module.includes(modul.key);
              const preis = einzelmodulPreis(modul.key);
              return (
                <button
                  key={modul.key}
                  type="button"
                  className="mod"
                  aria-pressed={an}
                  onClick={() => schalte(modul.key)}
                >
                  <span className="box" />
                  <span>
                    <b>{modul.label}</b>
                    <small>{formatEuro(preis.grundCent + preis.nutzerCent * angebot.nutzer)} im Monat</small>
                  </span>
                </button>
              );
            })}
          </div>
          {angebot.empfehlung ? (
            <div className="banner">
              Mit dem Paket „{TIERS.find((tier) => tier.key === angebot.empfehlung?.tier)?.name}“ bekommen Sie mehr
              Module und sparen {formatEuro(angebot.empfehlung.ersparnisCent)} im Monat.{" "}
              <button
                type="button"
                className="btn"
                style={{ marginLeft: 8 }}
                onClick={() => waehleTier(angebot.empfehlung!.tier)}
              >
                Paket nehmen
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      <div className="panel summe">
        <div className="cols" style={{ gridTemplateColumns: "1fr 1fr", alignItems: "start" }}>
          <div>
            <h3 style={{ marginTop: 0 }}>Monatlich</h3>
            <table>
              <tbody>
                {angebot.monatlich.zeilen.map((zeile, index) => (
                  <tr key={`${zeile.text}-${index}`}>
                    <td>{zeile.text}</td>
                    <td>{formatEuro(zeile.cent)}</td>
                  </tr>
                ))}
                <tr className="total">
                  <td>Summe je Monat</td>
                  <td>{formatEuro(angebot.monatlich.summeCent)}</td>
                </tr>
                <tr>
                  <td>Im Jahr</td>
                  <td>{formatEuro(angebot.jahrCent)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div>
            <h3 style={{ marginTop: 0 }}>Einmalig</h3>
            <table>
              <tbody>
                {angebot.einmalig.zeilen.map((zeile, index) => (
                  <tr key={`${zeile.text}-${index}`}>
                    <td>{zeile.text}</td>
                    <td>{formatEuro(zeile.cent)}</td>
                  </tr>
                ))}
                <tr className="total">
                  <td>Summe einmalig</td>
                  <td>{formatEuro(angebot.einmalig.summeCent)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        {angebot.hinweise.map((hinweis) => (
          <p key={hinweis} className="hint" style={{ marginBottom: 0 }}>
            {hinweis}
          </p>
        ))}
        <p className="hint" style={{ marginBottom: 0 }}>
          Richtwert, kein verbindliches Angebot. Einrichtung: Mandant, Rollen, Module, Logo, Standorte und
          Administrationsschulung. Schulung: je 6 Personen ein Termin.
        </p>
      </div>

      <div style={{ marginTop: 20, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" className="btn primary" disabled={laeuft || angefragt} onClick={anfragen}>
          {angefragt ? "Anfrage gesendet" : laeuft ? "Wird gesendet …" : "Unverbindlich anfragen"}
        </button>
        <span className="hint" aria-live="polite">
          {stand === "speichert"
            ? "Wird gespeichert …"
            : stand === "gespeichert"
              ? "Auswahl gespeichert"
              : stand === "fehler"
                ? "Speichern fehlgeschlagen"
                : ""}
        </span>
      </div>
      {angefragt ? (
        <div className="done" role="status">
          Danke, Ihre Anfrage ist bei uns angekommen. Wir melden uns bei Ihnen.
        </div>
      ) : null}
      {fehler ? (
        <div className="err" role="alert">
          {fehler}
        </div>
      ) : null}
    </section>
  );
}

/* --------------------------------------------------------------- Skyline */

const BREITE = 122;
const LUECKE = 20;
const GRUPPEN_LUECKE = 70;
const BODEN = 400;

type Fokus = { art: "modul" | "haus"; key: string } | null;

/**
 * Ihr Intranet als Skyline.
 *
 * Jedes Haus ist ein Gebäude, jedes Fenster ein Modul, das dort im Alltag Sinn
 * ergibt. Erleuchtet ist, was zur Auswahl gehört, dunkel bleibt der Rest, wie
 * im AHOI-Zeichen. Wer ein Modul wählt, sieht es in allen Häusern aufleuchten,
 * durch Bahnen verbunden. Die Höhe eines Hauses hängt nicht an der Auswahl,
 * sondern an dem, was dort möglich wäre: ein größeres Paket macht Fenster hell,
 * lässt kein Haus wachsen. Die Zuordnung ist ein Vorschlag aus den Angaben zu den
 * Häusern, keine Messung.
 */
export function Intranet({
  ansicht,
  konf,
  onAngebot,
}: {
  ansicht: PitchAnsicht;
  konf: LeadKonfiguration;
  onAngebot: () => void;
}) {
  const angebot = berechneAngebot({
    haeuser: konf.haeuser,
    nutzer: konf.nutzer,
    keyUser: konf.keyUser,
    tier: konf.tier as TierKey | null,
    module: konf.module,
  });
  const gewaehlt = new Set(angebot.module);

  const module = useMemo(
    () =>
      [...(MODULE_DEFINITIONS as readonly ModuleDefinition[])].sort(
        (a, b) => MODULE_GROUPS.indexOf(a.group) - MODULE_GROUPS.indexOf(b.group),
      ),
    [],
  );
  const haeuser = ansicht.standorte;
  const hatWerkstatt = (haus: PitchAnsicht["standorte"][number]) =>
    haus.leistungen.some((leistung) => /service|werkstatt/i.test(leistung));

  // Häuser eines gemeinsamen Standorts stehen nebeneinander, getrennt von den übrigen.
  const reihenfolge = [...haeuser.map((haus, index) => ({ haus, index }))].sort((a, b) =>
    (a.haus.campus ?? `~${a.index}`).localeCompare(b.haus.campus ?? `~${b.index}`, "de"),
  );

  let x = 40;
  const gebaeude = reihenfolge.map(({ haus, index }, position) => {
    const vorher = reihenfolge[position - 1];
    if (position > 0) x += vorher.haus.campus && vorher.haus.campus === haus.campus ? LUECKE : GRUPPEN_LUECKE;
    const fenster = module.filter((modul) => modul.core || haus.vorschlagModule.includes(modul.key));
    const zeilen = Math.ceil(fenster.length / 3);
    const eintrag = { haus, index, x, fenster, hoehe: zeilen * 40 + 56 };
    x += BREITE;
    return eintrag;
  });
  const gesamt = x + 40;
  const oberkante = Math.max(0, Math.round(BODEN - Math.max(...gebaeude.map((g) => g.hoehe)) - 110));

  const plattformen: { von: number; bis: number; name: string }[] = [];
  for (const g of gebaeude) {
    if (!g.haus.campus) continue;
    const letzte = plattformen[plattformen.length - 1];
    if (letzte && letzte.name === g.haus.campus) letzte.bis = g.x + BREITE;
    else plattformen.push({ von: g.x, bis: g.x + BREITE, name: g.haus.campus });
  }

  const [angeheftet, setAngeheftet] = useState<Fokus>(null);
  const [schwebe, setSchwebe] = useState<Fokus>(null);
  const zeige = angeheftet ?? schwebe;
  const heftAn = (fokus: NonNullable<Fokus>) =>
    setAngeheftet((alt) => (alt?.art === fokus.art && alt.key === fokus.key ? null : fokus));
  const nachTaste = (fokus: NonNullable<Fokus>) => (e: { key: string }) => {
    if (e.key === "Enter" || e.key === " ") heftAn(fokus);
  };

  const fensterPunkt = (g: (typeof gebaeude)[number], nummer: number) => ({
    x: g.x + 16 + (nummer % 3) * 34 + 13,
    y: BODEN - g.hoehe + 18 + Math.floor(nummer / 3) * 40 + 14,
  });

  // Bahnen verbinden das gewählte Modul von Haus zu Haus, von links nach rechts.
  const bahnPunkte =
    zeige?.art === "modul"
      ? gebaeude
          .map((g) => ({ g, nummer: g.fenster.findIndex((modul) => modul.key === zeige.key) }))
          .filter((eintrag) => eintrag.nummer >= 0)
          .map((eintrag) => fensterPunkt(eintrag.g, eintrag.nummer))
          .sort((a, b) => a.x - b.x)
      : [];

  const nichtKern = module.filter((modul) => !modul.core && gewaehlt.has(modul.key));
  const offen = module.filter((modul) => !modul.core && !gewaehlt.has(modul.key));
  const aktivesHaus = zeige?.art === "haus" ? zeige.key : null;

  return (
    <section className="station">
      <div className="eyebrow">Ihr Intranet</div>
      <h2 style={{ marginTop: 10 }}>So sieht Ihre Auswahl aus</h2>
      <p className="lead">
        Jedes Haus ein Gebäude, jedes Fenster ein Modul. Hell ist, was zu Ihrer Auswahl gehört, dunkel bleibt der Rest,
        wie im AHOI-Zeichen. Tippen Sie ein Haus oder ein Fenster an und sehen Sie, was Sie damit tun können.
      </p>

      <div className="nacht">
        <svg
          viewBox={`0 ${oberkante} ${gesamt} ${470 - oberkante}`}
          role="group"
          aria-label="Ihre Häuser als Skyline, jedes Fenster ein Modul"
        >
          <defs>
            <linearGradient id="pitch-himmel" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#0B121A" />
              <stop offset="1" stopColor="#223142" />
            </linearGradient>
          </defs>
          <rect y={oberkante} width={gesamt} height={470 - oberkante} fill="url(#pitch-himmel)" />
          {Array.from({ length: 34 }, (_, i) => (
            <circle
              key={i}
              cx={(i * 211) % gesamt}
              cy={oberkante + 14 + ((i * 97) % 80)}
              r={i % 5 === 0 ? 1.8 : 1}
              fill="#fff"
              opacity={0.25 + (i % 4) * 0.12}
            />
          ))}
          <text className="sk-zahl" x="46" y={oberkante + 92}>
            {gewaehlt.size}
          </text>
          <text className="sk-zahl-text" x="48" y={oberkante + 122}>
            von {MODULE_DEFINITIONS.length} Modulen
          </text>

          <rect x="0" y={BODEN} width={gesamt} height="70" fill="#101820" />
          {plattformen.map((platte) => (
            <g key={platte.name}>
              <rect x={platte.von - 12} y={BODEN} width={platte.bis - platte.von + 24} height="10" fill="#324355" />
              <text x={(platte.von + platte.bis) / 2} y={BODEN + 36} textAnchor="middle" className="sk-platt">
                {platte.name}
              </text>
            </g>
          ))}

          {gebaeude.map((g) => {
            const oben = BODEN - g.hoehe;
            const gedimmt = aktivesHaus !== null && aktivesHaus !== g.haus.name;
            return (
              <g
                key={`${g.haus.name}-${g.index}`}
                className={`sk-haus ${gedimmt ? "dim" : ""} ${aktivesHaus === g.haus.name ? "fokus" : ""}`}
              >
                <rect
                  x={g.x}
                  y={oben}
                  width={BREITE}
                  height={g.hoehe}
                  rx="3"
                  className="sk-wand"
                  tabIndex={0}
                  role="button"
                  aria-label={g.haus.name}
                  onMouseEnter={() => setSchwebe({ art: "haus", key: g.haus.name })}
                  onMouseLeave={() => setSchwebe(null)}
                  onFocus={() => setSchwebe({ art: "haus", key: g.haus.name })}
                  onBlur={() => setSchwebe(null)}
                  onClick={() => heftAn({ art: "haus", key: g.haus.name })}
                  onKeyDown={nachTaste({ art: "haus", key: g.haus.name })}
                />
                <rect x={g.x - 5} y={oben - 8} width={BREITE + 10} height="8" rx="2" className="sk-dach" />
                {g.fenster.map((modul, nummer) => {
                  const an = gewaehlt.has(modul.key);
                  const p = fensterPunkt(g, nummer);
                  const gedimmtFenster = zeige?.art === "modul" && zeige.key !== modul.key;
                  const klasse = [
                    "sk-fenster",
                    an ? (modul.core ? "kern" : modul.stage === "beta" ? "beta" : "an") : "offen",
                    gedimmtFenster ? "dim" : "",
                    zeige?.art === "modul" && zeige.key === modul.key ? "fokus" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <rect
                      key={modul.key}
                      x={p.x - 13}
                      y={p.y - 14}
                      width="26"
                      height="28"
                      rx="2"
                      className={klasse}
                      tabIndex={0}
                      role="button"
                      aria-label={`${g.haus.name}: ${modul.label}, ${an ? "in Ihrer Auswahl" : "nicht in Ihrer Auswahl"}`}
                      onMouseEnter={() => setSchwebe({ art: "modul", key: modul.key })}
                      onMouseLeave={() => setSchwebe(null)}
                      onFocus={() => setSchwebe({ art: "modul", key: modul.key })}
                      onBlur={() => setSchwebe(null)}
                      onClick={() => heftAn({ art: "modul", key: modul.key })}
                      onKeyDown={nachTaste({ art: "modul", key: modul.key })}
                    />
                  );
                })}
                {hatWerkstatt(g.haus) ? (
                  <g aria-hidden="true">
                    <rect x={g.x + BREITE - 34} y={BODEN - 24} width="26" height="24" className="sk-tor" />
                    {[0, 1, 2, 3].map((linie) => (
                      <line
                        key={linie}
                        x1={g.x + BREITE - 34}
                        x2={g.x + BREITE - 8}
                        y1={BODEN - 20 + linie * 6}
                        y2={BODEN - 20 + linie * 6}
                        className="sk-tor-linie"
                      />
                    ))}
                  </g>
                ) : null}
                <text x={g.x + BREITE / 2} y={BODEN + 20} textAnchor="middle" className="sk-name">
                  {g.haus.name
                    .replace(/^(Autopark|Autohaus|Gebrauchtwagenzentrum) /, "")
                    .replace("CUPRA GARAGE ", "")
                    .replace(" Hannover", "")}
                </text>
              </g>
            );
          })}

          {bahnPunkte.slice(1).map((nach, i) => {
            const von = bahnPunkte[i];
            const bogen = Math.min(von.y, nach.y) - 40 - Math.abs(nach.x - von.x) * 0.18;
            return (
              <path
                key={`${von.x}-${nach.x}`}
                className="sk-bahn"
                d={`M${von.x} ${von.y} Q${(von.x + nach.x) / 2} ${bogen} ${nach.x} ${nach.y}`}
                pathLength={1}
              />
            );
          })}
        </svg>
      </div>

      <ul className="legende" aria-label="Legende">
        <li>
          <i className="l-fenster an" /> in Ihrer Auswahl
        </li>
        <li>
          <i className="l-fenster offen" /> nicht in Ihrer Auswahl
        </li>
        <li>
          <i className="l-fenster kern" /> Kernmodul, immer dabei
        </li>
        <li>
          <i className="l-tor" /> Haus mit Werkstatt
        </li>
        <li>
          <i className="l-platte" /> gemeinsamer Standort
        </li>
      </ul>

      <p className="hint" style={{ marginTop: 12 }}>
        Welches Haus welches Modul nutzt, ist unser Vorschlag aus den Angaben zu Ihren Häusern (Werkstatt,
        Öffnungszeiten, gemeinsamer Standort). Gemessen wird nichts. Im Betrieb schalten Sie Module für das ganze Haus
        ein, wer was sieht, steuern die Zielgruppen je Standort.
      </p>

      <aside className="panel detail graf-detail" aria-live="polite" style={{ marginTop: 16 }}>
        {!zeige ? (
          <>
            <span className="eyebrow">Ihre Auswahl</span>
            <h3>
              {gewaehlt.size} Module für {haeuser.length} Häuser
            </h3>
            <p style={{ margin: 0, color: "var(--muted)" }}>
              Drei Kernmodule sind immer dabei, dazu {nichtKern.length} gewählte.
              {offen.length > 0 ? ` ${offen.length} weitere gibt es dazu, sie bleiben dunkel.` : ""} Fahren Sie über ein
              Haus oder ein Fenster. Ein gewähltes Modul zieht Bahnen zu allen Häusern, die es nutzen.
            </p>
          </>
        ) : zeige.art === "modul" ? (
          <ModulDetail
            schluessel={zeige.key}
            gewaehlt={gewaehlt.has(zeige.key)}
            haeuser={gebaeude
              .filter((g) => g.fenster.some((modul) => modul.key === zeige.key) && !getModule(zeige.key)?.core)
              .map((g) => g.haus.name)}
            onAngebot={onAngebot}
          />
        ) : (
          <HausDetail
            haus={haeuser.find((haus) => haus.name === zeige.key)!}
            gewaehlt={gewaehlt}
            onModul={(key) => setAngeheftet({ art: "modul", key })}
          />
        )}
      </aside>

      <div className="chips" role="group" aria-label="Haus wählen" style={{ marginTop: 28 }}>
        {haeuser.map((haus, index) => (
          <button
            key={`${haus.name}-${index}`}
            type="button"
            className="chip"
            aria-pressed={zeige?.art === "haus" && zeige.key === haus.name}
            onClick={() => heftAn({ art: "haus", key: haus.name })}
          >
            {haus.name}
          </button>
        ))}
      </div>
      <div className="chips" role="group" aria-label="Modul wählen" style={{ marginTop: 0 }}>
        {nichtKern.map((modul) => (
          <button
            key={modul.key}
            type="button"
            className="chip"
            aria-pressed={zeige?.art === "modul" && zeige.key === modul.key}
            onClick={() => heftAn({ art: "modul", key: modul.key })}
          >
            {modul.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function ModulDetail({
  schluessel,
  gewaehlt,
  haeuser,
  onAngebot,
}: {
  schluessel: string;
  gewaehlt: boolean;
  haeuser: string[];
  onAngebot: () => void;
}) {
  const [ablauf, setAblauf] = useState(false);
  const modul = getModule(schluessel);
  if (!modul) return null;
  return (
    <>
      <div className="row">
        <span className="pill p-mute">{MODULE_GROUP_LABELS[modul.group]}</span>
        {modul.core ? <span className="pill p-mute">Kern</span> : null}
        {modul.stage === "beta" ? <span className="pill p-acc">Beta</span> : null}
        <span className={`pill ${gewaehlt ? "p-ok" : "p-wait"}`}>
          {gewaehlt ? "In Ihrer Auswahl" : "Nicht in Ihrer Auswahl"}
        </span>
      </div>
      <h3>{modul.label}</h3>
      <p style={{ margin: 0, color: "var(--muted)" }}>{modul.description}</p>
      <div className="fit">
        <span className="eyebrow">Was Sie damit tun können</span>
        <ul className="nutzen">
          {(MODUL_NUTZEN[schluessel] ?? []).map((satz) => (
            <li key={satz}>{satz}</li>
          ))}
        </ul>
      </div>
      {haeuser.length > 0 ? (
        <div className="fit">
          <span className="eyebrow">Besonders nah dran</span>
          <div className="row" style={{ marginTop: 8 }}>
            {haeuser.map((name) => (
              <span key={name} className="pill p-acc">
                {name}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      <div className="row" style={{ marginTop: 16 }}>
        <button type="button" className="btn primary" onClick={() => setAblauf(true)}>
          Ablauf ansehen
        </button>
        {!gewaehlt ? (
          <button type="button" className="btn" onClick={onAngebot}>
            Im Angebot ändern
          </button>
        ) : null}
      </div>
      {ablauf ? <ModulSlideshow schluessel={schluessel} onClose={() => setAblauf(false)} /> : null}
    </>
  );
}

function HausDetail({
  haus,
  gewaehlt,
  onModul,
}: {
  haus: PitchAnsicht["standorte"][number];
  gewaehlt: Set<string>;
  onModul: (key: string) => void;
}) {
  return (
    <>
      <div className="row">
        {haus.leistungen.map((leistung) => (
          <span key={leistung} className="pill p-mute">
            {leistung}
          </span>
        ))}
        {haus.campus ? <span className="pill p-acc">Verbund {haus.campus}</span> : null}
      </div>
      <h3>{haus.name}</h3>
      {haus.adresse ? <p style={{ margin: 0, color: "var(--quiet)", fontSize: 15 }}>{haus.adresse}</p> : null}
      <p style={{ margin: "12px 0 0", color: "var(--muted)" }}>{haus.vorschlagText}</p>
      <div className="fit">
        <span className="eyebrow">Module dieses Hauses</span>
        <div className="row" style={{ marginTop: 8 }}>
          {haus.vorschlagModule.map((key) =>
            gewaehlt.has(key) ? (
              <button key={key} type="button" className="pill p-acc" style={{ border: 0 }} onClick={() => onModul(key)}>
                {getModule(key)?.label}
              </button>
            ) : (
              <span key={key} className="pill p-mute" title="Nicht in Ihrer Auswahl">
                {getModule(key)?.label}
              </span>
            ),
          )}
        </div>
      </div>
    </>
  );
}
