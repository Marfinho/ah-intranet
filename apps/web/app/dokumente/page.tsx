import type { DocumentItem } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { FilterBar } from "@/components/filter-bar";
import { EmptyState, Section } from "@/components/ui";
import { ZielgruppeAnzeige } from "@/components/zielgruppe-anzeige";
import { apiGet } from "@/lib/api";
import { getZielgruppen, requireModule } from "@/lib/session";
import { formatDate } from "@/lib/utils";

interface DocumentsResponse {
  items: DocumentItem[];
  categories: string[];
}

const FILE_LABELS: Record<string, string> = { pdf: "PDF", docx: "Word", xlsx: "Excel", link: "Link" };

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: { search?: string; category?: string };
}) {
  await requireModule("documents");

  const query = new URLSearchParams();
  if (searchParams.search) query.set("search", searchParams.search);
  if (searchParams.category) query.set("category", searchParams.category);

  const data = await apiGet<DocumentsResponse>(`/documents?${query.toString()}`);
  const katalog = await getZielgruppen();

  return (
    <AppShell title="Dokumente & Vorlagen" subtitle="Freigegebene Unterlagen, Formulare und Richtlinien">
      <Section title={`${data.items.length} Dokumente`} subtitle="Nach Kategorie filtern oder Stichwort suchen">
        <div className="space-y-4">
          <FilterBar
            searchPlaceholder="Dokument suchen"
            selects={[
              {
                name: "category",
                label: "Alle Kategorien",
                options: data.categories.map((value) => ({ value, label: value })),
              },
            ]}
          />

          {data.items.length === 0 ? (
            <EmptyState title="Keine Dokumente gefunden" detail="Für diese Auswahl ist nichts hinterlegt." />
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {data.items.map((document) => (
                <li key={document.id} className="min-w-0 rounded-2xl border border-slate-200 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{document.title}</p>
                      <p className="mt-1 text-sm text-slate-600">{document.description}</p>
                    </div>
                    <span className="badge shrink-0 bg-brand-50 text-brand-700">
                      {FILE_LABELS[document.fileType] ?? document.fileType}
                    </span>
                  </div>

                  <p className="mt-3 text-xs text-slate-500">
                    {document.category} · {document.owner} · aktualisiert {formatDate(document.updatedAt)}
                  </p>

                  <div className="mt-3">
                    <ZielgruppeAnzeige scopes={document.audienceScopes} katalog={katalog} />
                  </div>

                  <a
                    href={document.url}
                    className="mt-4 inline-block ziel rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:border-brand-100 hover:bg-slate-50"
                  >
                    Öffnen
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>
    </AppShell>
  );
}
