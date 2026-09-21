import Link from "next/link";
import type { SearchHit } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { EmptyState, Section } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { requireModule } from "@/lib/session";

export default async function SearchPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  await requireModule("search");

  const query = (searchParams.q ?? "").trim();
  const hits = query.length >= 2 ? await apiGet<SearchHit[]>(`/search?q=${encodeURIComponent(query)}`) : [];

  // Nach Modul gruppieren, damit die Herkunft eines Treffers sofort klar ist.
  const byModule = new Map<string, SearchHit[]>();
  for (const hit of hits) {
    byModule.set(hit.moduleLabel, [...(byModule.get(hit.moduleLabel) ?? []), hit]);
  }

  return (
    <AppShell title="Suche" subtitle="Modulübergreifende Treffer aus News, Dokumenten, Wiki, Personen und Tickets">
      <Section title={query ? `Treffer für „${query}“` : "Suchbegriff eingeben"} subtitle={`${hits.length} Ergebnisse`}>
        {query.length < 2 ? (
          <EmptyState title="Mindestens zwei Zeichen" detail="Nutzen Sie das Suchfeld oben rechts." />
        ) : hits.length === 0 ? (
          <EmptyState
            title="Nichts gefunden"
            detail="Versuchen Sie einen anderen Begriff oder eine andere Schreibweise."
          />
        ) : (
          <div className="space-y-6">
            {[...byModule.entries()].map(([moduleLabel, moduleHits]) => (
              <div key={moduleLabel}>
                <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{moduleLabel}</p>
                <ul className="space-y-2">
                  {moduleHits.map((hit) => (
                    <li key={`${hit.module}-${hit.id}`}>
                      <Link
                        href={hit.href}
                        className="block rounded-2xl border border-slate-200 p-4 transition hover:border-brand-100 hover:bg-slate-50"
                      >
                        <p className="font-semibold text-slate-900">{hit.title}</p>
                        <p className="mt-1 text-sm text-slate-600">{hit.snippet}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Section>
    </AppShell>
  );
}
