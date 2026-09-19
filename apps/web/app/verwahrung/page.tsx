import type { CustodyItemSummary, EmployeeDirectoryEntry } from "@ah-intranet/shared";
import { CUSTODY_EVENT_LABELS, CUSTODY_KIND_LABELS, CUSTODY_STATUS_LABELS } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { FilterBar } from "@/components/filter-bar";
import { EmptyState, Section, Tag } from "@/components/ui";
import { CustodyComposer } from "./custody-composer";
import { CustodyActions } from "./custody-actions";
import { apiGet } from "@/lib/api";
import { can, requireModule } from "@/lib/session";
import { formatDate } from "@/lib/utils";

interface Organisation {
  locations: { id: string; name: string }[];
}

export default async function VerwahrungPage({
  searchParams,
}: {
  searchParams: { kind?: string; status?: string; search?: string };
}) {
  const session = await requireModule("custody");
  const darfBuchen = can(session, "custody.manage");

  const query = new URLSearchParams();
  if (searchParams.kind) query.set("kind", searchParams.kind);
  if (searchParams.status) query.set("status", searchParams.status);
  if (searchParams.search) query.set("search", searchParams.search);

  const [items, organisation, directory] = await Promise.all([
    apiGet<CustodyItemSummary[]>(`/verwahrung?${query.toString()}`),
    darfBuchen ? apiGet<Organisation>("/users/organisation") : Promise.resolve({ locations: [] }),
    darfBuchen ? apiGet<{ items: EmployeeDirectoryEntry[] }>("/directory") : Promise.resolve({ items: [] }),
  ]);

  const ausgegeben = items.filter((item) => item.status === "ausgegeben");

  return (
    <AppShell
      title="Fundsachen & Schlüssel"
      subtitle="Wer hat welchen Schlüssel, wo liegt welcher Fund – mit Übergabe und Zeitstempel"
    >
      {ausgegeben.length > 0 ? (
        <Section title={`${ausgegeben.length} Schlüssel unterwegs`} subtitle="Aktuell nicht im Haus">
          <div className="flex flex-wrap gap-2">
            {ausgegeben.map((item) => (
              <Tag key={item.id}>
                {item.title} → {item.holder ?? "unbekannt"}
              </Tag>
            ))}
          </div>
        </Section>
      ) : null}

      {darfBuchen ? (
        <Section title="Aufnehmen" subtitle="Bei einer Fundsache gehört der Fundort dazu">
          <CustodyComposer organisation={organisation} />
        </Section>
      ) : null}

      <Section title={`${items.length} Einträge`} subtitle="Jede Bewegung steht im Verlauf">
        <div className="space-y-4">
          <FilterBar
            selects={[
              {
                name: "kind",
                label: "Art",
                options: [
                  { value: "all", label: "Alle Arten" },
                  { value: "fundsache", label: "Fundsachen" },
                  { value: "schluessel", label: "Schlüssel" },
                ],
              },
              {
                name: "status",
                label: "Zustand",
                options: [
                  { value: "all", label: "Alle Zustände" },
                  { value: "verwahrt", label: "Verwahrt" },
                  { value: "ausgegeben", label: "Ausgegeben" },
                  { value: "abgeholt", label: "Abgeholt" },
                  { value: "entsorgt", label: "Entsorgt" },
                ],
              },
            ]}
          />

          {items.length === 0 ? (
            <EmptyState title="Nichts verwahrt" detail="Für diese Auswahl gibt es keine Einträge." />
          ) : (
            items.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {CUSTODY_KIND_LABELS[item.kind]}
                      {item.storagePlace ? ` · ${item.storagePlace}` : ""}
                      {item.location ? ` · ${item.location}` : ""}
                    </p>
                    {item.description ? <p className="mt-1 text-sm text-slate-600">{item.description}</p> : null}
                    {item.foundPlace ? (
                      <p className="mt-1 text-sm text-slate-500">
                        Gefunden {item.foundAt ? `am ${formatDate(item.foundAt)}` : ""} – {item.foundPlace}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Tag>{CUSTODY_STATUS_LABELS[item.status]}</Tag>
                    {item.holder ? <Tag>{item.holder}</Tag> : null}
                  </div>
                </div>

                {darfBuchen ? (
                  <CustodyActions
                    item={item}
                    people={directory.items.map((person) => ({ id: person.id, name: person.displayName }))}
                  />
                ) : null}

                {item.events.length > 0 ? (
                  <ol className="mt-4 space-y-1 border-t border-slate-100 pt-3 text-sm text-slate-600">
                    {item.events.map((event) => (
                      <li key={event.id}>
                        <span className="font-medium text-slate-800">{CUSTODY_EVENT_LABELS[event.kind]}</span>
                        {event.person ? ` – ${event.person}` : ""}
                        {event.note ? ` (${event.note})` : ""}
                        <span className="text-slate-400">
                          {" "}
                          · {formatDate(event.createdAt)} durch {event.actor}
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </div>
            ))
          )}
        </div>
      </Section>
    </AppShell>
  );
}
