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
  bahn,
  getModule,
  polar,
  ringSegment,
  segmente,
  verteile,
  waehlbareModule,
  type LeadKonfiguration,
  type ModuleDefinition,
  type PitchAnsicht,
  type TierKey,
} from "@ah-intranet/shared";
import { pitchAnfrageAction, pitchSpeichernAction } from "@/lib/actions";

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
          </aside>
        ) : null}
      </div>
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

/* ------------------------------------------------------------- Sternbild */

const GROESSE = 1000;
const MITTE = GROESSE / 2;
const R_HAUS = 125;
const R_INNEN = 262;
const R_AUSSEN = 306;

type Fokus = { art: "modul" | "haus"; key: string } | null;

/**
 * Ihr Intranet als Bild.
 *
 * Innen die Häuser, außen die Module als Ring. Gefüllt ist, was zur Auswahl
 * gehört, offen bleibt, was nicht dazugehört - wie im AHOI-Zeichen. Die Bahnen
 * zeigen, welches Haus welches Modul im Alltag nutzt. Die Abbildung ist ein
 * Vorschlag aus den Angaben zu den Häusern, keine Messung.
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
  const segs = useMemo(
    () =>
      segmente(
        module.length,
        module.map((modul) => MODULE_GROUPS.indexOf(modul.group)),
        1.4,
        -4,
      ),
    [module],
  );

  const haeuser = ansicht.standorte;
  const winkel = verteile(haeuser.length, 20);
  const hausPunkt = haeuser.map((_, index) => polar(MITTE, MITTE, haeuser.length === 1 ? 0 : R_HAUS, winkel[index]));
  const mitte = { x: MITTE, y: MITTE };

  const bahnen = haeuser.flatMap((haus, hausIndex) =>
    haus.vorschlagModule
      .filter((key) => gewaehlt.has(key) && !getModule(key)?.core)
      .map((key) => {
        const modulIndex = module.findIndex((modul) => modul.key === key);
        return {
          haus: hausIndex,
          modul: key,
          pfad: bahn(hausPunkt[hausIndex], polar(MITTE, MITTE, R_INNEN - 6, segs[modulIndex].mitte), mitte, 0.78),
        };
      }),
  );

  const verbuende = haeuser.flatMap((haus, index) =>
    haeuser
      .slice(index + 1)
      .map((anderes, offset) => ({
        von: index,
        nach: index + 1 + offset,
        gleich: haus.campus && haus.campus === anderes.campus,
      }))
      .filter((paar) => paar.gleich),
  );

  const [angeheftet, setAngeheftet] = useState<Fokus>(null);
  const [schwebe, setSchwebe] = useState<Fokus>(null);
  const aktiv = schwebe ?? angeheftet;
  const zeige = angeheftet ?? schwebe;

  const hausIndexAktiv = aktiv?.art === "haus" ? haeuser.findIndex((haus) => haus.name === aktiv.key) : -1;
  const heftAn = (fokus: NonNullable<Fokus>) =>
    setAngeheftet((alt) => (alt?.art === fokus.art && alt.key === fokus.key ? null : fokus));

  const hatWerkstatt = (index: number) =>
    haeuser[index].leistungen.some((leistung) => /service|werkstatt/i.test(leistung));
  const nichtKern = module.filter((modul) => !modul.core && gewaehlt.has(modul.key));
  const kern = module.filter((modul) => modul.core);

  const modulGedimmt = (key: string, kernModul: boolean) => {
    if (!aktiv) return false;
    if (aktiv.art === "modul") return aktiv.key !== key;
    return kernModul ? false : !bahnen.some((eintrag) => eintrag.haus === hausIndexAktiv && eintrag.modul === key);
  };
  const hausGedimmt = (index: number) => {
    if (!aktiv) return false;
    if (aktiv.art === "haus") return index !== hausIndexAktiv;
    return !bahnen.some((eintrag) => eintrag.modul === aktiv.key && eintrag.haus === index);
  };
  const bahnZustand = (haus: number, modul: string) => {
    if (!aktiv) return "";
    const trifft = aktiv.art === "modul" ? aktiv.key === modul : hausIndexAktiv === haus;
    return trifft ? "an" : "aus";
  };

  return (
    <section className="station">
      <div className="eyebrow">Ihr Intranet</div>
      <h2 style={{ marginTop: 10 }}>So sieht Ihre Auswahl aus</h2>
      <p className="lead">
        Innen Ihre Häuser, außen die Module. Gefüllt ist, was zu Ihrer Auswahl gehört, offen bleibt der Rest, wie im
        AHOI-Zeichen. Tippen Sie ein Haus oder ein Modul an und sehen Sie, was Sie damit tun können.
      </p>

      <div className="graf-layout">
        <div>
          <svg
            className="graf"
            viewBox={`0 0 ${GROESSE} ${GROESSE}`}
            role="group"
            aria-label="Ihre Häuser und Module als Bild"
          >
            {/* Ringe als ruhiger Hintergrund */}
            <circle className="graf-ring" cx={MITTE} cy={MITTE} r={R_HAUS} />
            <circle className="graf-ring" cx={MITTE} cy={MITTE} r={R_INNEN - 22} />

            {verbuende.map((paar) => (
              <line
                key={`${paar.von}-${paar.nach}`}
                className="verbund"
                x1={hausPunkt[paar.von].x}
                y1={hausPunkt[paar.von].y}
                x2={hausPunkt[paar.nach].x}
                y2={hausPunkt[paar.nach].y}
              />
            ))}

            {bahnen.map((eintrag, index) => (
              <path
                key={`${eintrag.haus}-${eintrag.modul}`}
                className={`bahn ${bahnZustand(eintrag.haus, eintrag.modul)}`}
                d={eintrag.pfad}
                pathLength={1}
                style={{ animationDelay: `${index * 45}ms` }}
              />
            ))}

            {module.map((modul, index) => {
              const an = gewaehlt.has(modul.key);
              const segment = segs[index];
              const gedimmt = modulGedimmt(modul.key, modul.core);
              const klasse = [
                "graf-modul",
                an ? "an" : "aus",
                modul.core ? "kern" : "",
                modul.stage === "beta" ? "beta" : "",
                gedimmt ? "dim" : "",
                zeige?.art === "modul" && zeige.key === modul.key ? "fokus" : "",
              ]
                .filter(Boolean)
                .join(" ");
              const text = polar(MITTE, MITTE, R_AUSSEN + 12, segment.mitte);
              const links = segment.mitte > 180;
              const drehung = segment.mitte - 90 + (links ? 180 : 0);
              return (
                <g key={modul.key}>
                  <path
                    className={klasse}
                    d={ringSegment(MITTE, MITTE, R_INNEN, R_AUSSEN, segment.von, segment.bis)}
                    tabIndex={0}
                    role="button"
                    aria-label={`${modul.label}, ${an ? "in Ihrer Auswahl" : "nicht in Ihrer Auswahl"}`}
                    onMouseEnter={() => setSchwebe({ art: "modul", key: modul.key })}
                    onMouseLeave={() => setSchwebe(null)}
                    onFocus={() => setSchwebe({ art: "modul", key: modul.key })}
                    onBlur={() => setSchwebe(null)}
                    onClick={() => heftAn({ art: "modul", key: modul.key })}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && heftAn({ art: "modul", key: modul.key })}
                  />
                  <g
                    transform={`translate(${text.x} ${text.y}) rotate(${drehung})`}
                    className={`graf-label-gruppe ${an ? "an" : "aus"} ${gedimmt ? "dim" : ""}`}
                  >
                    <text className="graf-label" textAnchor={links ? "end" : "start"} dominantBaseline="central">
                      {modul.label}
                    </text>
                  </g>
                </g>
              );
            })}

            {haeuser.map((haus, index) => (
              <g
                key={`${haus.name}-${index}`}
                className={`knoten-gruppe ${hausGedimmt(index) ? "dim" : ""}`}
                tabIndex={0}
                role="button"
                aria-label={`${haus.name}${hatWerkstatt(index) ? ", mit Werkstatt" : ", Verkaufshaus"}`}
                onMouseEnter={() => setSchwebe({ art: "haus", key: haus.name })}
                onMouseLeave={() => setSchwebe(null)}
                onFocus={() => setSchwebe({ art: "haus", key: haus.name })}
                onBlur={() => setSchwebe(null)}
                onClick={() => heftAn({ art: "haus", key: haus.name })}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && heftAn({ art: "haus", key: haus.name })}
              >
                <circle cx={hausPunkt[index].x} cy={hausPunkt[index].y} r={30} className="knoten-flaeche" />
                <circle
                  cx={hausPunkt[index].x}
                  cy={hausPunkt[index].y}
                  r={14}
                  className={`knoten ${hatWerkstatt(index) ? "werkstatt" : ""} ${hausIndexAktiv === index ? "fokus" : ""}`}
                />
                <title>{haus.name}</title>
              </g>
            ))}

            <text className="mitte-zahl" x={MITTE} y={MITTE + 4} textAnchor="middle">
              {gewaehlt.size}
            </text>
            <text className="mitte-text" x={MITTE} y={MITTE + 44} textAnchor="middle">
              von {MODULE_DEFINITIONS.length} Modulen
            </text>
          </svg>

          <ul className="legende" aria-label="Legende">
            <li>
              <i className="l-modul an" /> in Ihrer Auswahl
            </li>
            <li>
              <i className="l-modul aus" /> nicht in Ihrer Auswahl
            </li>
            <li>
              <i className="l-modul kern" /> Kernmodul, immer dabei
            </li>
            <li>
              <i className="l-knoten werkstatt" /> Haus mit Werkstatt
            </li>
            <li>
              <i className="l-knoten" /> Verkaufshaus
            </li>
            <li>
              <i className="l-verbund" /> gemeinsamer Standort
            </li>
          </ul>
        </div>

        <aside className="panel detail graf-detail" aria-live="polite">
          {!zeige ? (
            <>
              <span className="eyebrow">Ihre Auswahl</span>
              <h3>
                {gewaehlt.size} Module für {haeuser.length} Häuser
              </h3>
              <p style={{ margin: 0, color: "var(--muted)" }}>
                {kern.length} Kernmodule sind immer dabei, dazu {nichtKern.length} gewählte. Die feinen Bahnen zeigen,
                wo wir den Einsatz im Alltag eines Hauses sehen. Wählen Sie links etwas aus.
              </p>
            </>
          ) : zeige.art === "modul" ? (
            <ModulDetail
              schluessel={zeige.key}
              gewaehlt={gewaehlt.has(zeige.key)}
              haeuser={bahnen
                .filter((eintrag) => eintrag.modul === zeige.key)
                .map((eintrag) => haeuser[eintrag.haus].name)}
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
      </div>

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
      {!gewaehlt ? (
        <button type="button" className="btn" style={{ marginTop: 16 }} onClick={onAngebot}>
          Im Angebot ändern
        </button>
      ) : null}
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
