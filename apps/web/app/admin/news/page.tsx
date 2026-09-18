import type { NewsItem } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { ActionButton } from "@/components/forms";
import { EmptyState, PriorityBadge, Section, StatusBadge } from "@/components/ui";
import { NewsComposer } from "./news-composer";
import { apiGet } from "@/lib/api";
import { requireRole } from "@/lib/session";
import { deleteNewsAction, setNewsStatusAction } from "@/lib/actions";
import { formatDate } from "@/lib/utils";

export default async function NewsAdminPage() {
  const session = await requireRole("admin", "fachbereichsadmin");
  const items = await apiGet<NewsItem[]>("/news?status=all");

  return (
    <AppShell title="News verwalten" subtitle="Beiträge verfassen, veröffentlichen und archivieren">
      <Section
        title="Neuen Beitrag verfassen"
        subtitle="Zielgruppe und Priorität steuern Sichtbarkeit und Benachrichtigung"
      >
        <NewsComposer />
      </Section>

      <Section title={`${items.length} Beiträge`} subtitle="Entwürfe, veröffentlichte und archivierte Beiträge">
        {items.length === 0 ? (
          <EmptyState title="Noch keine Beiträge" detail="Verfassen Sie oben den ersten Beitrag." />
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.id} className="rounded-2xl border border-slate-200 p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={item.status} />
                      <PriorityBadge priority={item.priority} />
                      {item.pinned ? <span className="badge bg-amber-50 text-amber-700">angepinnt</span> : null}
                    </div>
                    <p className="mt-2 font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{item.teaser}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {item.author} · {item.publishedAt ? formatDate(item.publishedAt) : "nicht veröffentlicht"} ·{" "}
                      {item.audienceScopes.join(", ")}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    {item.status !== "published" ? (
                      <ActionButton action={setNewsStatusAction.bind(null, item.id, "published")}>
                        Veröffentlichen
                      </ActionButton>
                    ) : (
                      <ActionButton variant="ghost" action={setNewsStatusAction.bind(null, item.id, "archived")}>
                        Archivieren
                      </ActionButton>
                    )}

                    {session.roles.includes("admin") ? (
                      <ActionButton
                        variant="danger"
                        confirm={`Beitrag "${item.title}" endgültig löschen?`}
                        action={deleteNewsAction.bind(null, item.id)}
                      >
                        Löschen
                      </ActionButton>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </AppShell>
  );
}
