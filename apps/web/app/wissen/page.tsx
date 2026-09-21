import Link from "next/link";
import type { WikiArticle } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { FilterBar } from "@/components/filter-bar";
import { EmptyState, Section, Tag } from "@/components/ui";
import { WikiComposer } from "./wiki-composer";
import { ZielgruppeAnzeige } from "@/components/zielgruppe-anzeige";
import { apiGet } from "@/lib/api";
import { can, getZielgruppen, requireModule } from "@/lib/session";
import { formatDate } from "@/lib/utils";

interface WikiResponse {
  items: WikiArticle[];
  categories: string[];
}

export default async function WikiPage({ searchParams }: { searchParams: { search?: string; category?: string } }) {
  const session = await requireModule("wiki");

  const query = new URLSearchParams();
  if (searchParams.search) query.set("search", searchParams.search);
  if (searchParams.category) query.set("category", searchParams.category);

  const data = await apiGet<WikiResponse>(`/wiki?${query.toString()}`);
  const katalog = await getZielgruppen();

  return (
    <AppShell title="Wissensdatenbank" subtitle="Anleitungen, Prozessbeschreibungen und interne Standards">
      <Section title={`${data.items.length} Artikel`} subtitle="Nach Kategorie, Stichwort oder Schlagwort suchen">
        <div className="space-y-4">
          <FilterBar
            searchPlaceholder="Artikel oder Schlagwort suchen"
            selects={[
              {
                name: "category",
                label: "Alle Kategorien",
                options: data.categories.map((value) => ({ value, label: value })),
              },
            ]}
          />

          {data.items.length === 0 ? (
            <EmptyState
              title="Keine Artikel gefunden"
              detail="Passen Sie die Suche an oder legen Sie einen Artikel an."
            />
          ) : (
            <ul className="space-y-3">
              {data.items.map((article) => (
                <li key={article.id}>
                  <Link
                    href={`/wissen/${article.slug}`}
                    className="block rounded-2xl border border-slate-200 p-5 transition hover:border-brand-100 hover:bg-slate-50"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="badge bg-brand-50 text-brand-700">{article.category}</span>
                      {!article.isPublished ? <span className="badge bg-slate-200 text-slate-700">Entwurf</span> : null}
                      <ZielgruppeAnzeige scopes={article.audienceScopes} katalog={katalog} />
                    </div>
                    <p className="mt-3 font-semibold text-slate-900">{article.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{article.excerpt} …</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {article.tags.map((tag) => (
                        <Tag key={tag}>#{tag}</Tag>
                      ))}
                      <span className="text-xs text-slate-500">
                        {article.author} · {formatDate(article.updatedAt)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>

      {can(session, "wiki.manage") ? (
        <Section title="Neuen Artikel anlegen" subtitle="Wissen dokumentieren und für alle auffindbar machen">
          <WikiComposer categories={data.categories} katalog={katalog} />
        </Section>
      ) : null}
    </AppShell>
  );
}
