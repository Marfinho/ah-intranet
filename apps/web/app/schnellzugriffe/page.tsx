import type { QuickLink } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { ActionButton } from "@/components/forms";
import { EmptyState, Section } from "@/components/ui";
import { QuickLinkComposer } from "./quicklink-composer";
import { apiGet } from "@/lib/api";
import { can, requireModule } from "@/lib/session";
import { deleteQuickLinkAction } from "@/lib/actions";

export default async function QuickLinksPage() {
  const session = await requireModule("quicklinks");
  const isAdmin = can(session, "quicklinks.manage");
  const links = await apiGet<QuickLink[]>(`/quicklinks${isAdmin ? "?all=true" : ""}`);

  return (
    <AppShell title="Schnellzugriffe" subtitle="Direkte Wege in Fachanwendungen und Herstellerportale">
      <Section title={`${links.length} Verknüpfungen`} subtitle="Öffnen sich in einem neuen Tab">
        {links.length === 0 ? (
          <EmptyState title="Keine Schnellzugriffe" detail="Die Administration hat noch keine Links hinterlegt." />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {links.map((link) => (
              <li key={link.id} className="rounded-2xl border border-slate-200 p-5">
                <a href={link.url} target="_blank" rel="noreferrer" className="block">
                  <p className="font-semibold text-brand-700 hover:underline">{link.label}</p>
                  {link.description ? <p className="mt-1 text-sm text-slate-600">{link.description}</p> : null}
                  <p className="mt-2 truncate text-xs text-slate-400">{link.url}</p>
                </a>

                {isAdmin ? (
                  <div className="mt-4 flex items-center gap-3">
                    {!link.isActive ? <span className="badge bg-slate-200 text-slate-700">inaktiv</span> : null}
                    <ActionButton
                      variant="ghost"
                      confirm={`Schnellzugriff "${link.label}" löschen?`}
                      action={deleteQuickLinkAction.bind(null, link.id)}
                    >
                      Löschen
                    </ActionButton>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {isAdmin ? (
        <Section title="Schnellzugriff hinzufügen" subtitle="Erscheint für alle Mitarbeitenden auf dem Dashboard">
          <QuickLinkComposer />
        </Section>
      ) : null}
    </AppShell>
  );
}
