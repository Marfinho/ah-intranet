"use client";

import { useState, useTransition } from "react";
import type { BetriebstagEintrag, BetriebstagVorschlag } from "@ah-intranet/shared";
import { BETRIEBSTAG_ARTEN, BUNDESLAENDER } from "@ah-intranet/shared";
import {
  deleteBetriebstagAction,
  uebernimmFeiertageAction,
  uebernimmVorschlagAction,
  uebertrageBetriebstagAction,
  updateBetriebstagAction,
} from "@/lib/actions";

const ARTEN = Object.fromEntries(BETRIEBSTAG_ARTEN.map((art) => [art.key, art.name]));

function tagText(datum: string): string {
  return new Date(`${datum}T00:00:00Z`).toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
}

function melde(result: { ok: boolean; message?: string }) {
  if (!result.ok && result.message) {
    window.alert(result.message);
  }
}

const knopf =
  "rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60";

type StandortRef = { id: string; name: string };

function Eintrag({
  eintrag,
  weitere,
}: {
  eintrag: BetriebstagEintrag;
  /** Standorte, die diesen Tag unter diesem Namen noch nicht führen. */
  weitere: StandortRef[];
}) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(eintrag.name);
  const [offen, setOffen] = useState(false);
  const [gewaehlt, setGewaehlt] = useState<string[]>([]);

  return (
    <li className="flex flex-wrap items-center gap-3 py-2">
      <span className="w-24 shrink-0 text-sm tabular-nums text-slate-600">{tagText(eintrag.datum)}</span>
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        onBlur={() => {
          if (name.trim() !== eintrag.name) {
            startTransition(async () => melde(await updateBetriebstagAction(eintrag.id, { name })));
          }
        }}
        aria-label={`Bezeichnung für ${tagText(eintrag.datum)}`}
        className="min-w-0 flex-1 rounded-lg border border-transparent px-2 py-1 text-sm font-medium text-slate-900 hover:border-slate-200"
      />
      <span className="badge bg-slate-100 text-slate-600">{ARTEN[eintrag.art]}</span>
      <select
        value={eintrag.arbeitsfrei ? "frei" : "arbeit"}
        disabled={pending}
        onChange={(event) =>
          startTransition(async () =>
            melde(await updateBetriebstagAction(eintrag.id, { arbeitsfrei: event.target.value === "frei" })),
          )
        }
        aria-label="Arbeitsfrei oder Arbeitstag"
        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
      >
        <option value="frei">arbeitsfrei</option>
        <option value="arbeit">Arbeitstag</option>
      </select>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => melde(await deleteBetriebstagAction(eintrag.id)))}
        className="text-xs font-semibold text-red-700 hover:underline disabled:opacity-40"
      >
        Löschen
      </button>
      {eintrag.locationId && weitere.length > 0 ? (
        <button type="button" onClick={() => setOffen((wert) => !wert)} className={knopf}>
          Auf weitere Standorte
        </button>
      ) : null}
      {offen ? (
        <div className="w-full rounded-xl bg-slate-50 px-3 py-3">
          <div className="flex flex-wrap gap-2">
            {weitere.map((standort) => (
              <label
                key={standort.id}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
              >
                <input
                  type="checkbox"
                  checked={gewaehlt.includes(standort.id)}
                  onChange={(event) =>
                    setGewaehlt((aktuell) =>
                      event.target.checked ? [...aktuell, standort.id] : aktuell.filter((id) => id !== standort.id),
                    )
                  }
                  className="h-4 w-4"
                />
                {standort.name}
              </label>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => setGewaehlt(weitere.map((standort) => standort.id))} className={knopf}>
              Alle wählen
            </button>
            <button
              type="button"
              disabled={pending || gewaehlt.length === 0}
              onClick={() =>
                startTransition(async () => {
                  const result = await uebertrageBetriebstagAction(eintrag.id, gewaehlt);
                  melde(result);
                  if (result.ok) {
                    setOffen(false);
                    setGewaehlt([]);
                  }
                })
              }
              className="rounded-xl bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {gewaehlt.length > 0 ? `Auf ${gewaehlt.length} übertragen` : "Übertragen"}
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

/** Ein Standort (oder das ganze Haus) mit seinen Einträgen und den noch offenen Vorschlägen. */
export function KalenderStandort({
  standort,
  jahr,
  eintraege,
  vorschlaege,
  standorte,
  alleEintraege,
}: {
  /** Alle Standorte des Hauses und alle Einträge des Jahres - für die Übertragung. */
  standorte: StandortRef[];
  alleEintraege: BetriebstagEintrag[];
  /** `null` = Einträge für das ganze Haus */
  standort: { id: string; name: string; bundesland: string | null } | null;
  jahr: number;
  eintraege: BetriebstagEintrag[];
  vorschlaege: BetriebstagVorschlag[];
}) {
  const [pending, startTransition] = useTransition();
  const feiertage = vorschlaege.filter((vorschlag) => vorschlag.art === "feiertag");
  const brueckentage = vorschlaege.filter((vorschlag) => vorschlag.art === "brueckentag");
  const land = BUNDESLAENDER.find((eintrag) => eintrag.code === standort?.bundesland)?.name;

  return (
    <div className="rounded-2xl border border-slate-200 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold text-slate-900">{standort?.name ?? "Ganzes Haus"}</p>
        {standort ? (
          <p className="text-xs text-slate-500">{land ?? "Bundesland nicht angegeben"}</p>
        ) : (
          <p className="text-xs text-slate-500">gilt an allen Standorten</p>
        )}
      </div>

      {standort && !standort.bundesland ? (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Ohne Bundesland gibt es keine Feiertagsvorschläge. Tragen Sie es unter Standorte & Marken ein.
        </p>
      ) : null}

      {standort && feiertage.length > 0 ? (
        <div className="mt-3 rounded-xl bg-brand-50 px-3 py-3 text-sm text-brand-900">
          <p className="font-semibold">{feiertage.length} Feiertage als Vorschlag</p>
          <p className="mt-1 text-xs">
            {feiertage.map((vorschlag) => `${tagText(vorschlag.datum)} ${vorschlag.name}`).join(" · ")}
          </p>
          <p className="mt-1 text-xs">
            Ortsabhängige Feiertage (z. B. Fronleichnam in Teilen Sachsens) bitte selbst prüfen und nachtragen.
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(async () => melde(await uebernimmFeiertageAction(jahr, standort.id)))}
            className="mt-3 rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {pending ? "Übernimmt …" : `Alle ${feiertage.length} übernehmen`}
          </button>
        </div>
      ) : null}

      {eintraege.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Noch keine Einträge für {jahr}.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {eintraege.map((eintrag) => (
            <Eintrag
              key={eintrag.id}
              eintrag={eintrag}
              weitere={standorte.filter(
                (ziel) =>
                  ziel.id !== eintrag.locationId &&
                  !alleEintraege.some(
                    (andere) =>
                      andere.locationId === ziel.id && andere.datum === eintrag.datum && andere.name === eintrag.name,
                  ),
              )}
            />
          ))}
        </ul>
      )}

      {standort && brueckentage.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mögliche Brückentage</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {brueckentage.map((vorschlag) => (
              <li key={vorschlag.datum}>
                <button
                  type="button"
                  disabled={pending}
                  title={`${vorschlag.name} eintragen`}
                  onClick={() =>
                    startTransition(async () =>
                      melde(
                        await uebernimmVorschlagAction({
                          datum: vorschlag.datum,
                          art: vorschlag.art,
                          name: vorschlag.name,
                          arbeitsfrei: vorschlag.arbeitsfrei,
                          locationIds: [vorschlag.locationId],
                        }),
                      ),
                    )
                  }
                  className={knopf}
                >
                  + {tagText(vorschlag.datum)} · {vorschlag.name.replace("Brückentag (", "").replace(")", "")}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
