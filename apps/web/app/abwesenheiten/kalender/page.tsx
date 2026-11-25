import Link from "next/link";
import type { AbwesenheitsKalender } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { EmptyState, Section } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { requireModule } from "@/lib/session";

const ART_STIL: Record<string, string> = {
  urlaub: "bg-sky-200 text-sky-900",
  krank: "bg-rose-200 text-rose-900",
  gleitzeit: "bg-slate-200 text-slate-800",
  sonderurlaub: "bg-violet-200 text-violet-900",
  fortbildung: "bg-amber-200 text-amber-900",
  abwesend: "bg-slate-300 text-slate-800",
};

const ART_NAME: Record<string, string> = {
  urlaub: "Urlaub",
  krank: "Krank",
  gleitzeit: "Gleitzeit",
  sonderurlaub: "Sonderurlaub",
  fortbildung: "Schulung",
  abwesend: "Abwesend",
};

function monatsgrenzen(monat: string): { von: string; bis: string; tage: string[]; vorher: string; nachher: string } {
  const [jahr, nummer] = monat.split("-").map(Number);
  const anzahl = new Date(Date.UTC(jahr, nummer, 0)).getUTCDate();
  const tage = Array.from({ length: anzahl }, (_, index) => {
    const tag = String(index + 1).padStart(2, "0");
    return `${monat}-${tag}`;
  });
  const verschoben = (differenz: number) => {
    const datum = new Date(Date.UTC(jahr, nummer - 1 + differenz, 1));
    return `${datum.getUTCFullYear()}-${String(datum.getUTCMonth() + 1).padStart(2, "0")}`;
  };
  return { von: tage[0], bis: tage[tage.length - 1], tage, vorher: verschoben(-1), nachher: verschoben(1) };
}

export default async function AbwesenheitsKalenderPage(props: { searchParams: Promise<{ monat?: string }> }) {
  const searchParams = await props.searchParams;
  await requireModule("absences");

  const heute = new Date();
  const monat = /^\d{4}-(0[1-9]|1[0-2])$/.test(searchParams.monat ?? "")
    ? searchParams.monat!
    : `${heute.getUTCFullYear()}-${String(heute.getUTCMonth() + 1).padStart(2, "0")}`;
  const { von, bis, tage, vorher, nachher } = monatsgrenzen(monat);

  const kalender = await apiGet<AbwesenheitsKalender>(`/absences/kalender?von=${von}&bis=${bis}`);
  const freiesDatum = new Set(
    kalender.tage.filter((tag) => tag.arbeitsfrei && tag.locationId === null).map((tag) => tag.datum),
  );
  const titel = new Date(`${monat}-01T00:00:00Z`).toLocaleDateString("de-DE", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <AppShell title="Abwesenheitskalender" subtitle="Wer fehlt wann - Urlaub, Krankheit, Schulung">
      <Section
        title={titel}
        subtitle="Ihr Team sehen Sie als „abwesend“, den Grund nur bei sich selbst und den Personen, die Sie führen"
      >
        <div className="mb-4 flex items-center gap-4 text-sm font-semibold">
          <Link href={`/abwesenheiten/kalender?monat=${vorher}`} className="text-brand-700 hover:underline">
            ← Vormonat
          </Link>
          <Link href={`/abwesenheiten/kalender?monat=${nachher}`} className="text-brand-700 hover:underline">
            Folgemonat →
          </Link>
          <Link href="/abwesenheiten" className="ml-auto text-slate-600 hover:underline">
            Zurück zu den Anträgen
          </Link>
        </div>

        {kalender.personen.length === 0 ? (
          <EmptyState title="Niemand zu sehen" detail="Für Sie sind in diesem Zeitraum keine Personen sichtbar." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-white px-3 py-2 text-left font-semibold text-slate-600">
                    Person
                  </th>
                  {tage.map((tag) => {
                    const wochentag = new Date(`${tag}T00:00:00Z`).getUTCDay();
                    const frei = wochentag === 0 || wochentag === 6 || freiesDatum.has(tag);
                    return (
                      <th
                        key={tag}
                        title={kalender.tage.find((eintrag) => eintrag.datum === tag)?.name}
                        className={`w-7 px-0.5 py-2 text-center font-medium tabular-nums ${frei ? "bg-slate-100 text-slate-400" : "text-slate-600"}`}
                      >
                        {Number(tag.slice(8))}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {kalender.personen.map((person) => (
                  <tr key={person.id}>
                    <th className="sticky left-0 z-10 whitespace-nowrap border-t border-slate-100 bg-white px-3 py-2 text-left font-medium text-slate-900">
                      {person.name}
                      {!person.hasAccess ? <span className="ml-2 text-slate-400">ohne Zugang</span> : null}
                    </th>
                    {tage.map((tag) => {
                      const wochentag = new Date(`${tag}T00:00:00Z`).getUTCDay();
                      const frei = wochentag === 0 || wochentag === 6 || freiesDatum.has(tag);
                      const eintrag = person.eintraege.find((e) => e.von <= tag && e.bis >= tag);
                      const halb =
                        eintrag &&
                        ((eintrag.von === tag && eintrag.startHalb) || (eintrag.bis === tag && eintrag.endHalb));
                      return (
                        <td
                          key={tag}
                          title={
                            eintrag
                              ? `${ART_NAME[eintrag.art]}${eintrag.status === "submitted" ? " (beantragt)" : ""}`
                              : undefined
                          }
                          className={`h-8 border-t border-slate-100 text-center ${
                            eintrag ? ART_STIL[eintrag.art] : frei ? "bg-slate-100" : ""
                          } ${eintrag?.status === "submitted" ? "opacity-60" : ""}`}
                        >
                          {eintrag ? (halb ? "½" : "") : ""}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <ul className="mt-4 flex flex-wrap gap-3 text-xs text-slate-600">
          {Object.entries(ART_NAME).map(([art, name]) => (
            <li key={art} className="flex items-center gap-2">
              <span className={`inline-block h-3 w-3 rounded-sm ${ART_STIL[art].split(" ")[0]}`} />
              {name}
            </li>
          ))}
          <li>Blass = beantragt · ½ = halber Tag · grau = Wochenende oder frei</li>
        </ul>
      </Section>
    </AppShell>
  );
}
