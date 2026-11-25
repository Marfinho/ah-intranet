import Link from "next/link";
import type { PlanVorschau, SchichtartItem } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { EmptyState, Section } from "@/components/ui";
import { UebernahmeKnopf } from "./uebernahme-knopf";
import { ApiError, apiGet } from "@/lib/api";
import { requireModule, requirePermission } from "@/lib/session";

const DATUM = /^\d{4}-\d{2}-\d{2}$/;

function tag(datum: string): string {
  return new Date(`${datum}T00:00:00Z`).toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
}

/** Nächster Montag ab heute und der Sonntag zwei Wochen später: ein sinnvoller Standardzeitraum. */
function standardZeitraum(): { von: string; bis: string } {
  const heute = new Date();
  const wochentag = heute.getUTCDay() === 0 ? 7 : heute.getUTCDay();
  const montag = new Date(Date.UTC(heute.getUTCFullYear(), heute.getUTCMonth(), heute.getUTCDate() + (8 - wochentag)));
  const ende = new Date(montag.getTime() + 13 * 86_400_000);
  return { von: montag.toISOString().slice(0, 10), bis: ende.toISOString().slice(0, 10) };
}

export default async function PlanungPage(props: {
  searchParams: Promise<{ von?: string; bis?: string; arten?: string | string[] }>;
}) {
  const searchParams = await props.searchParams;
  await requireModule("shifts");
  await requirePermission("shifts.manage");

  const arten = (await apiGet<SchichtartItem[]>("/schichtplanung/arten")).filter((art) => art.aktiv);
  const standard = standardZeitraum();
  const von = searchParams.von && DATUM.test(searchParams.von) ? searchParams.von : standard.von;
  const bis = searchParams.bis && DATUM.test(searchParams.bis) ? searchParams.bis : standard.bis;
  const gewaehlt = (Array.isArray(searchParams.arten) ? searchParams.arten : searchParams.arten ? [searchParams.arten] : []).filter(
    (id) => arten.some((art) => art.id === id),
  );
  const rechnen = Boolean(searchParams.von && searchParams.bis);

  let vorschau: PlanVorschau | null = null;
  let fehler: string | null = null;
  if (rechnen) {
    try {
      const query = new URLSearchParams({ von, bis });
      if (gewaehlt.length > 0) query.set("arten", gewaehlt.join(","));
      vorschau = await apiGet<PlanVorschau>(`/schichtplanung/vorschau?${query.toString()}`);
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      fehler = error.message;
    }
  }

  const tage = vorschau
    ? [...new Set([...vorschau.zuweisungen.map((z) => z.datum), ...vorschau.luecken.map((l) => l.datum)])].sort()
    : [];
  const unterMindest = vorschau?.luecken.filter((luecke) => luecke.unterMindest).length ?? 0;

  return (
    <AppShell
      title="Automatische Planung"
      subtitle="Besetzt Schichtarten nach Zeitfenster, Arbeitstagen, Abwesenheit, Betriebskalender und Arbeitszeitgesetz"
    >
      <p className="text-sm">
        <Link href="/schichtplan" className="font-semibold text-brand-700 hover:underline">
          ← Zurück zum Schichtplan
        </Link>
      </p>

      <Section title="Zeitraum und Schichtarten" subtitle="Die Vorschau rechnet nur - geschrieben wird erst bei der Übernahme">
        {arten.length === 0 ? (
          <EmptyState
            title="Keine aktive Schichtart"
            detail="Legen Sie zuerst unter „Schichtarten“ eine an."
          />
        ) : (
          <form method="get" className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Von
              <input name="von" type="date" required defaultValue={von} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Bis
              <input name="bis" type="date" required defaultValue={bis} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
            </label>
            <fieldset className="md:col-span-2">
              <legend className="text-sm font-medium text-slate-700">Schichtarten</legend>
              <p className="text-xs text-slate-500">Keine Auswahl heißt: alle aktiven</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {arten.map((art) => (
                  <label key={art.id} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
                    <input type="checkbox" name="arten" value={art.id} defaultChecked={gewaehlt.includes(art.id)} className="h-4 w-4" />
                    {art.name} <span className="text-xs text-slate-500">{art.bereich}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="md:col-span-2">
              <button type="submit" className="rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700">
                Vorschau berechnen
              </button>
            </div>
          </form>
        )}
      </Section>

      {fehler ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-900">{fehler}</p> : null}

      {vorschau ? (
        <Section
          title={`Vorschau ${tag(vorschau.von)} – ${tag(vorschau.bis)}`}
          subtitle={`${vorschau.zuweisungen.length} Schicht(en) würden besetzt, ${vorschau.luecken.length} Lücke(n)`}
        >
          {unterMindest > 0 ? (
            <p className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-900">
              <strong>{unterMindest} Schicht(en) bleiben unter der Mindestbesetzung.</strong> Für sie legt die Übernahme
              offene Schichten an, damit sie im Plan sichtbar sind.
            </p>
          ) : null}
          {vorschau.ohneWochenstunden.length > 0 ? (
            <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Ohne hinterlegte Wochenarbeitszeit (keine Obergrenze): {vorschau.ohneWochenstunden.join(", ")}.
            </p>
          ) : null}

          {tage.length === 0 ? (
            <EmptyState title="Nichts zu planen" detail="Alles ist besetzt, oder an diesen Tagen wird nicht gearbeitet." />
          ) : (
            <div className="space-y-5">
              {tage.map((datum) => (
                <div key={datum}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{tag(datum)}</p>
                  <ul className="mt-2 space-y-2">
                    {vorschau!.zuweisungen
                      .filter((z) => z.datum === datum)
                      .map((z) => (
                        <li key={`${z.schichtartId}${z.userId}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3 text-sm">
                          <span className="font-medium text-slate-900">{z.schichtart}</span>
                          <span className="text-slate-600">
                            {z.start}–{z.ende} Uhr
                          </span>
                          <span className="badge bg-emerald-100 text-emerald-800">{z.name}</span>
                        </li>
                      ))}
                    {vorschau!.luecken
                      .filter((l) => l.datum === datum)
                      .map((l) => (
                        <li
                          key={`l${l.schichtartId}`}
                          className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm ${
                            l.unterMindest ? "border-rose-200 bg-rose-50" : "border-amber-200 bg-amber-50"
                          }`}
                        >
                          <span className="font-medium text-slate-900">{l.schichtart}</span>
                          <span className="text-slate-700">
                            {l.besetzt} von {l.soll} besetzt (mindestens {l.mindest})
                          </span>
                          <span className={`badge ${l.unterMindest ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"}`}>
                            {l.unterMindest ? "unter Mindestbesetzung" : "unter Ideal"}
                          </span>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {vorschau.zuweisungen.length + unterMindest > 0 ? (
            <div className="mt-6 border-t border-slate-100 pt-5">
              <UebernahmeKnopf von={vorschau.von} bis={vorschau.bis} schichtartIds={gewaehlt} anzahl={vorschau.zuweisungen.length} />
            </div>
          ) : null}
        </Section>
      ) : null}
    </AppShell>
  );
}
