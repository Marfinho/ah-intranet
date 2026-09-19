import type { DocumentItem } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { ActionButton } from "@/components/forms";
import { EmptyState, Section, Tag } from "@/components/ui";
import { DocumentComposer } from "./document-composer";
import { apiGet } from "@/lib/api";
import { can, requirePermission } from "@/lib/session";
import { deleteDocumentAction } from "@/lib/actions";
import { formatDate } from "@/lib/utils";

export default async function DocumentsAdminPage() {
  const session = await requirePermission("documents.manage");
  const data = await apiGet<{ items: DocumentItem[]; categories: string[] }>("/documents");

  return (
    <AppShell title="Dokumente verwalten" subtitle="Vorlagen, Formulare und Richtlinien pflegen">
      <Section title="Dokument hinzufügen" subtitle="Verlinkt auf eine Datei im DMS oder eine interne Adresse">
        <DocumentComposer categories={data.categories} />
      </Section>

      <Section title={`${data.items.length} Dokumente`} subtitle="Inklusive deaktivierter Einträge">
        {data.items.length === 0 ? (
          <EmptyState title="Keine Dokumente" detail="Legen Sie oben das erste Dokument an." />
        ) : (
          <ul className="space-y-3">
            {data.items.map((document) => (
              <li
                key={document.id}
                className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-5 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">{document.title}</span>
                    <Tag>{document.category}</Tag>
                    {!document.isActive ? <span className="badge bg-rose-100 text-rose-800">inaktiv</span> : null}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{document.description}</p>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {document.url} · {document.owner} · {formatDate(document.updatedAt)}
                  </p>
                </div>

                {can(session, "documents.manage") ? (
                  <ActionButton
                    variant="ghost"
                    confirm={`Dokument "${document.title}" löschen?`}
                    action={deleteDocumentAction.bind(null, document.id)}
                  >
                    Löschen
                  </ActionButton>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </AppShell>
  );
}
