import Link from "next/link";
import type { NewsItem } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { FilterBar } from "@/components/filter-bar";
import { EmptyState, PriorityBadge, Section, StatusBadge } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { can, requireModule } from "@/lib/session";
import { formatDate } from "@/lib/utils";

export default async function NewsPage({
  searchParams,
}: {
  searchParams: { search?: string; priority?: string; status?: string; unread?: string };
}) {
  const session = await requireModule("news");

  const query = new URLSearchParams();
  if (searchParams.search) query.set("search", searchParams.search);
  if (searchParams.priority) query.set("priority", searchParams.priority);
  if (searchParams.status) query.set("status", searchParams.status);
  if (searchParams.unread) query.set("unread", searchParams.unread);

  const items = await apiGet<NewsItem[]>(`/news?${query.toString()}`);
  const manage = can(session, "news.publish");

  return (
    <AppShell title="Aktuelles" subtitle="Interne Nachrichten für Ihre Standorte und Fachbereiche">
      <Section
        title={`${items.length} Beiträge`}
        subtitle="Nach Priorität, Status und Stichwort filtern"
        action={
          manage ? (
            <Link
              href="/admin/news"
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Beitrag verfassen
            </Link>
          ) : null
        }
      >
        <div className="space-y-4">
          <FilterBar
            searchPlaceholder="Beiträge durchsuchen"
            selects={[
              {
                name: "priority",
                label: "Alle Prioritäten",
                options: ["niedrig", "normal", "hoch", "kritisch"].map((value) => ({ value, label: value })),
              },
              ...(manage
                ? [
                    {
                      name: "status",
                      label: "Alle Status",
                      options: [
                        { value: "published", label: "Veröffentlicht" },
                        { value: "draft", label: "Entwurf" },
                        { value: "archived", label: "Archiviert" },
                      ],
                    },
                  ]
                : []),
            ]}
          />

          {items.length === 0 ? (
            <EmptyState
              title="Keine Beiträge gefunden"
              detail="Passen Sie die Filter an oder setzen Sie die Suche zurück."
            />
          ) : (
            <ul className="space-y-3">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/aktuelles/${item.slug}`}
                    className="block rounded-2xl border border-slate-200 p-5 transition hover:border-brand-100 hover:bg-slate-50"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <PriorityBadge priority={item.priority} />
                      {item.status !== "published" ? <StatusBadge status={item.status} /> : null}
                      {!item.read ? <span className="badge bg-brand-50 text-brand-700">ungelesen</span> : null}
                      {item.pinned ? <span className="badge bg-amber-50 text-amber-700">angepinnt</span> : null}
                    </div>
                    <p className="mt-3 text-lg font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{item.teaser}</p>
                    <p className="mt-3 text-xs text-slate-500">
                      {item.author} · {item.publishedAt ? formatDate(item.publishedAt) : "nicht veröffentlicht"}
                      {item.commentCount > 0 ? ` · ${item.commentCount} Kommentare` : ""}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>
    </AppShell>
  );
}
