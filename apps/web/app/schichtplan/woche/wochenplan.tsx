"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { lokaleUhrzeit, type PlanEntwurfKopf, type ShiftItem } from "@ah-intranet/shared";
import { erstelleEntwurfAction, loescheEntwurfAction } from "@/lib/actions";
import { Zeitraster, type Block } from "./zeitraster";

export interface Hinweis {
  userId: string;
  datum: string;
  schwere: "verstoss" | "hinweis";
}

function datumKurz(datum: string): string {
  return new Date(`${datum}T00:00:00Z`).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
}

/**
 * Der veröffentlichte Plan der Woche - schreibgeschützt.
 *
 * Geändert wird nur im Entwurf: wer den Plan pflegen darf, startet hier ein leeres Blatt oder eine
 * Kopie des Bestands, oder öffnet einen vorhandenen Entwurf. Dass der Plan sich nie ändert, ohne
 * dass jemand „speichern" gedrückt hat, ist der Grund: jede Änderung meldet sich bei den Betroffenen.
 */
export function Wochenplan({
  tage,
  heute,
  schichten,
  darfPflegen,
  freieTage,
  hinweise,
  entwuerfe,
}: {
  tage: string[];
  heute: string;
  schichten: ShiftItem[];
  darfPflegen: boolean;
  freieTage: Record<string, string>;
  hinweise: Hinweis[];
  entwuerfe: PlanEntwurfKopf[];
}) {
  const router = useRouter();
  const [auswahl, setAuswahl] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [arbeitet, setArbeitet] = useState(false);

  const bloecke = useMemo<Block[]>(() => {
    const marken = new Map<string, "verstoss" | "hinweis">();
    for (const eintrag of hinweise) {
      const schluessel = `${eintrag.userId}|${eintrag.datum}`;
      if (marken.get(schluessel) !== "verstoss") marken.set(schluessel, eintrag.schwere);
    }
    return schichten.map((schicht) => ({
      key: schicht.id,
      startsAt: schicht.startsAt,
      endsAt: schicht.endsAt,
      label: schicht.label,
      person: schicht.assignee ?? null,
      mine: Boolean(schicht.mine),
      status: "unveraendert" as const,
      editierbar: false,
      konflikt: false,
      marke: schicht.assigneeId ? marken.get(`${schicht.assigneeId}|${schicht.startsAt.slice(0, 10)}`) : undefined,
    }));
  }, [schichten, hinweise]);

  const beginne = async (basis: "leer" | "bestand") => {
    setArbeitet(true);
    setFehler(null);
    const ergebnis = await erstelleEntwurfAction({ von: tage[0], bis: tage[6], basis, name: name.trim() || undefined });
    setArbeitet(false);
    if (!ergebnis.ok) {
      setFehler(ergebnis.message);
      return;
    }
    router.push(`/schichtplan/woche?datum=${tage[0]}&entwurf=${ergebnis.id}`);
  };

  const gewaehlt = auswahl ? schichten.find((schicht) => schicht.id === auswahl) : undefined;

  return (
    <div className="space-y-4">
      {fehler ? (
        <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {fehler}
        </p>
      ) : null}

      {darfPflegen ? (
        <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
          <div>
            <p className="font-semibold text-slate-900">Plan bearbeiten</p>
            <p className="mt-1 text-sm text-slate-600">
              Das ist der veröffentlichte Plan. Änderungen entstehen in einem <strong>Entwurf</strong>: Sie planen in
              Ruhe, lassen bei Bedarf automatisch befüllen und drücken erst am Ende „Plan speichern und melden“. Bis
              dahin erfährt niemand etwas.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm font-medium text-slate-700">
              Name (optional)
              <input
                value={name}
                onChange={(ereignis) => setName(ereignis.target.value)}
                placeholder={`Entwurf ${datumKurz(tage[0])}.`}
                className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <button
              type="button"
              disabled={arbeitet}
              onClick={() => void beginne("leer")}
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              Mit leerem Blatt beginnen
            </button>
            <button
              type="button"
              disabled={arbeitet}
              onClick={() => void beginne("bestand")}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              Bestehenden Plan bearbeiten ({schichten.length} Schichten)
            </button>
          </div>
          {schichten.length > 0 ? (
            <p className="text-xs text-slate-500">
              Ein leeres Blatt ändert die {schichten.length} vorhandenen Schichten nicht: sie bleiben, erscheinen im
              Entwurf ausgegraut und zählen bei Überschneidungen mit.
            </p>
          ) : null}

          {entwuerfe.length > 0 ? (
            <div>
              <p className="text-sm font-semibold text-slate-900">Entwürfe für diese Woche</p>
              <ul className="mt-2 space-y-2">
                {entwuerfe.map((entwurf) => (
                  <li
                    key={entwurf.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    <span>
                      <span className="font-medium text-slate-900">{entwurf.name}</span>
                      <span className="text-slate-500">
                        {" "}
                        · {entwurf.anzahl} Schichten · zuletzt {entwurf.aktualisiertVon ?? entwurf.erstelltVon},{" "}
                        {new Date(entwurf.aktualisiertAm).toLocaleString("de-DE", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        Uhr
                      </span>
                    </span>
                    <span className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => router.push(`/schichtplan/woche?datum=${tage[0]}&entwurf=${entwurf.id}`)}
                        className="font-semibold text-brand-700 hover:underline"
                      >
                        Öffnen
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!window.confirm(`Entwurf "${entwurf.name}" verwerfen?`)) return;
                          const ergebnis = await loescheEntwurfAction(entwurf.id);
                          if (!ergebnis.ok && ergebnis.message) setFehler(ergebnis.message);
                          else router.refresh();
                        }}
                        className="font-semibold text-red-700 hover:underline"
                      >
                        Verwerfen
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <Zeitraster
        tage={tage}
        heute={heute}
        bloecke={bloecke}
        freieTage={freieTage}
        auswahl={auswahl}
        onWaehle={setAuswahl}
        onAendere={() => undefined}
      />

      {gewaehlt ? (
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="font-semibold text-slate-900">{gewaehlt.label}</p>
          <p className="mt-1 text-sm text-slate-600">
            {datumKurz(gewaehlt.startsAt.slice(0, 10))} · {lokaleUhrzeit(new Date(gewaehlt.startsAt))}–
            {lokaleUhrzeit(new Date(gewaehlt.endsAt))} Uhr
            {gewaehlt.location ? ` · ${gewaehlt.location}` : ""}
            {gewaehlt.department ? ` · ${gewaehlt.department}` : ""}
          </p>
          <p className="mt-1 text-sm text-slate-600">{gewaehlt.assignee ?? "Offen"}</p>
          {gewaehlt.note ? <p className="mt-1 text-sm text-slate-500">{gewaehlt.note}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
