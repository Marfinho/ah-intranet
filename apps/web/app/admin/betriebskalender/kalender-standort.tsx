"use client";

import { useState, useTransition } from "react";
import type { BetriebstagEintrag, BetriebstagVorschlag } from "@ah-intranet/shared";
import { BETRIEBSTAG_ARTEN, BUNDESLAENDER } from "@ah-intranet/shared";
import {
  deleteBetriebstagAction,
  uebernimmFeiertageAction,
  uebernimmVorschlagAction,
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

function Eintrag({ eintrag }: { eintrag: BetriebstagEintrag }) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(eintrag.name);

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
    </li>
  );
}

/** Ein Standort (oder das ganze Haus) mit seinen Einträgen und den noch offenen Vorschlägen. */
export function KalenderStandort({
  standort,
  jahr,
  eintraege,
  vorschlaege,
}: {
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
            <Eintrag key={eintrag.id} eintrag={eintrag} />
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
                          locationId: vorschlag.locationId,
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
