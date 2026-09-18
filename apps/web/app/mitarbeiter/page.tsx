import type { EmployeeDirectoryEntry } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { FilterBar } from "@/components/filter-bar";
import { EmptyState, Section, Tag } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { requireModule } from "@/lib/session";

interface DirectoryResponse {
  items: EmployeeDirectoryEntry[];
  locations: string[];
  departments: string[];
}

const PRESENCE_STYLES: Record<string, string> = {
  "vor Ort": "bg-emerald-100 text-emerald-800",
  mobil: "bg-sky-100 text-sky-800",
  abwesend: "bg-slate-200 text-slate-700",
};

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: { search?: string; location?: string; department?: string };
}) {
  await requireModule("directory");

  const query = new URLSearchParams();
  if (searchParams.search) query.set("search", searchParams.search);
  if (searchParams.location) query.set("location", searchParams.location);
  if (searchParams.department) query.set("department", searchParams.department);

  const data = await apiGet<DirectoryResponse>(`/directory?${query.toString()}`);

  return (
    <AppShell title="Mitarbeiterverzeichnis" subtitle="Ansprechpartner, Durchwahlen und Zuständigkeiten">
      <Section title={`${data.items.length} Personen`} subtitle="Nach Name, Funktion, Standort oder Zuständigkeit suchen">
        <div className="space-y-4">
          <FilterBar
            searchPlaceholder="Name, Funktion oder Zuständigkeit"
            selects={[
              {
                name: "location",
                label: "Alle Standorte",
                options: data.locations.map((value) => ({ value, label: value })),
              },
              {
                name: "department",
                label: "Alle Abteilungen",
                options: data.departments.map((value) => ({ value, label: value })),
              },
            ]}
          />

          {data.items.length === 0 ? (
            <EmptyState title="Keine Treffer" detail="Für diese Filterkombination wurde niemand gefunden." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.items.map((person) => (
                <article key={person.id} className="rounded-2xl border border-slate-200 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{person.displayName}</p>
                      <p className="truncate text-sm text-slate-600">{person.jobTitle}</p>
                    </div>
                    <span className={`badge shrink-0 ${PRESENCE_STYLES[person.presence] ?? "bg-slate-100"}`}>
                      {person.presence}
                    </span>
                  </div>

                  <dl className="mt-4 space-y-1 text-sm text-slate-600">
                    <div className="flex gap-2">
                      <dt className="text-slate-500">Standort:</dt>
                      <dd>{person.location ?? "–"}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-slate-500">Abteilung:</dt>
                      <dd>{person.department ?? "–"}</dd>
                    </div>
                    {person.phone ? (
                      <div className="flex gap-2">
                        <dt className="text-slate-500">Telefon:</dt>
                        <dd>
                          <a href={`tel:${person.phone.replace(/\s/g, "")}`} className="text-brand-700 hover:underline">
                            {person.phone}
                          </a>
                        </dd>
                      </div>
                    ) : null}
                    {person.mobile ? (
                      <div className="flex gap-2">
                        <dt className="text-slate-500">Mobil:</dt>
                        <dd>
                          <a href={`tel:${person.mobile.replace(/\s/g, "")}`} className="text-brand-700 hover:underline">
                            {person.mobile}
                          </a>
                        </dd>
                      </div>
                    ) : null}
                    {person.email ? (
                      <div className="flex gap-2">
                        <dt className="text-slate-500">E-Mail:</dt>
                        <dd className="min-w-0">
                          <a href={`mailto:${person.email}`} className="block truncate text-brand-700 hover:underline">
                            {person.email}
                          </a>
                        </dd>
                      </div>
                    ) : null}
                  </dl>

                  {person.responsibilities.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {person.responsibilities.map((entry) => (
                        <Tag key={entry}>{entry}</Tag>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </div>
      </Section>
    </AppShell>
  );
}
