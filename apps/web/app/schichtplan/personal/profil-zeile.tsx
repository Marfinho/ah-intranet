"use client";

import { useState, useTransition } from "react";
import { WOCHENTAGE, type ArbeitszeitProfil } from "@ah-intranet/shared";
import { setzeArbeitszeitProfilAction } from "@/lib/actions";

/** Wochenstunden, Zeitfenster und Arbeitstage einer Person. */
export function ProfilZeile({ profil }: { profil: ArbeitszeitProfil }) {
  const [pending, startTransition] = useTransition();
  const [wochenstunden, setWochenstunden] = useState(profil.wochenstunden?.toString() ?? "");
  const [von, setVon] = useState(profil.zeitfensterVon ?? "");
  const [bis, setBis] = useState(profil.zeitfensterBis ?? "");
  const [tage, setTage] = useState<number[]>(profil.arbeitstage);
  const [meldung, setMeldung] = useState<string | null>(null);

  const speichern = () =>
    startTransition(async () => {
      const result = await setzeArbeitszeitProfilAction(profil.id, {
        wochenstunden: wochenstunden === "" ? null : Number(wochenstunden.replace(",", ".")),
        zeitfensterVon: von || null,
        zeitfensterBis: bis || null,
        arbeitstage: tage,
      });
      setMeldung(result.ok ? "Gespeichert" : (result.message ?? "Fehlgeschlagen"));
    });

  return (
    <li className="rounded-2xl border border-slate-200 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold text-slate-900">
          {profil.displayName}
          {!profil.hasAccess ? <span className="badge ml-2 bg-slate-100 text-slate-600">ohne Zugang</span> : null}
        </p>
        <p className="text-xs text-slate-500">
          {[profil.location, profil.department].filter(Boolean).join(" · ") || "ohne Standort"}
        </p>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <label className="text-sm font-medium text-slate-700">
          Wochenarbeitszeit (Stunden)
          <input
            type="number"
            min={0}
            max={60}
            step={0.5}
            value={wochenstunden}
            onChange={(event) => setWochenstunden(event.target.value)}
            placeholder="nicht hinterlegt"
            className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
          />
          <span className="mt-1 block text-xs font-normal text-slate-500">Die Planung überschreitet sie nie</span>
        </label>

        <label className="text-sm font-medium text-slate-700">
          Zeitfenster ab
          <input
            type="time"
            value={von}
            onChange={(event) => setVon(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
          />
          <span className="mt-1 block text-xs font-normal text-slate-500">Leer = ganztags, z. B. 08:00</span>
        </label>

        <label className="text-sm font-medium text-slate-700">
          Zeitfenster bis
          <input
            type="time"
            value={bis}
            onChange={(event) => setBis(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
          />
          <span className="mt-1 block text-xs font-normal text-slate-500">z. B. 13:00 für nur vormittags</span>
        </label>
      </div>

      <fieldset className="mt-4">
        <legend className="text-sm font-medium text-slate-700">Arbeitstage</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {WOCHENTAGE.map((tag) => (
            <label
              key={tag.nummer}
              className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                checked={tage.includes(tag.nummer)}
                onChange={(event) =>
                  setTage((aktuell) =>
                    event.target.checked
                      ? [...aktuell, tag.nummer].sort()
                      : aktuell.filter((nummer) => nummer !== tag.nummer),
                  )
                }
                className="h-4 w-4"
              />
              {tag.kurz}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={speichern}
          className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Speichert …" : "Speichern"}
        </button>
        {meldung ? <span className="text-sm text-slate-600">{meldung}</span> : null}
      </div>
    </li>
  );
}
