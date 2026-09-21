import Link from "next/link";
import { ORDER_STATUSES, type ApprovalTask } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { FilterBar } from "@/components/filter-bar";
import { ActionButton } from "@/components/forms";
import { EmptyState, Section, StatusBadge, statusLabel } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { requireModule, requirePermission } from "@/lib/session";
import { bulkOrderAction, orderTransitionAction } from "@/lib/actions";
import { formatDate } from "@/lib/utils";

export default async function ApprovalsPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ status?: string; search?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  await requireModule("approvals");
  await requirePermission("orders.approve");

  const query = new URLSearchParams();
  if (searchParams.status) query.set("status", searchParams.status);
  if (searchParams.search) query.set("search", searchParams.search);

  const tasks = await apiGet<ApprovalTask[]>(`/approvals?${query.toString()}`);
  const readyForBulk = tasks.filter((task) => ["approved", "queued_for_bulk_order"].includes(task.status));

  return (
    <AppShell title="Freigaben" subtitle="Einstufiger Freigabeprozess und externe Sammelbestellung">
      <Section
        title={`${tasks.length} Vorgänge`}
        subtitle="Offene Freigaben und für die Sammelbestellung vorgemerkte Bestellungen"
        action={
          readyForBulk.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <ActionButton
                action={bulkOrderAction.bind(null, "business_card")}
                confirm="Alle freigegebenen Visitenkartenbestellungen als extern bestellt markieren?"
              >
                Sammelbestellung Visitenkarten
              </ActionButton>
              <ActionButton
                variant="ghost"
                action={bulkOrderAction.bind(null, "workwear")}
                confirm="Alle freigegebenen Kleidungsbestellungen als extern bestellt markieren?"
              >
                Sammelbestellung Kleidung
              </ActionButton>
            </div>
          ) : null
        }
      >
        <div className="space-y-4">
          <FilterBar
            searchPlaceholder="Bestellnummer oder Person"
            selects={[
              {
                name: "status",
                label: "Offene Vorgänge",
                options: ORDER_STATUSES.map((value) => ({ value, label: statusLabel(value) })),
              },
            ]}
          />

          {tasks.length === 0 ? (
            <EmptyState title="Nichts zu tun" detail="Aktuell warten keine Bestellungen auf eine Entscheidung." />
          ) : (
            <ul className="space-y-4">
              {tasks.map((task) => (
                <li key={task.id} className="rounded-2xl border border-slate-200 p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <Link
                        href={`/bestellungen/${task.orderId}`}
                        className="font-semibold text-slate-900 hover:underline"
                      >
                        {task.orderNumber}
                      </Link>
                      <p className="mt-1 text-sm text-slate-600">
                        {task.requester} · {task.scope} · {formatDate(task.createdAt)}
                      </p>
                      <p className="mt-1 text-sm text-slate-700">{task.summary}</p>
                    </div>
                    <StatusBadge status={task.status} />
                  </div>

                  <p className="mt-3 text-sm text-slate-600">Nächster Schritt: {task.nextAction}</p>

                  <div className="mt-4 flex flex-wrap gap-3">
                    {task.status === "submitted" ? (
                      <>
                        <ActionButton
                          variant="success"
                          action={orderTransitionAction.bind(null, task.orderId, "approved", undefined)}
                        >
                          Genehmigen
                        </ActionButton>
                        <ActionButton
                          variant="danger"
                          confirm={`Bestellung ${task.orderNumber} ablehnen?`}
                          action={orderTransitionAction.bind(null, task.orderId, "rejected", undefined)}
                        >
                          Ablehnen
                        </ActionButton>
                      </>
                    ) : null}

                    {task.status === "approved" ? (
                      <ActionButton
                        action={orderTransitionAction.bind(null, task.orderId, "queued_for_bulk_order", undefined)}
                      >
                        Für Sammelbestellung vormerken
                      </ActionButton>
                    ) : null}

                    {task.status === "queued_for_bulk_order" ? (
                      <ActionButton action={orderTransitionAction.bind(null, task.orderId, "ordered", undefined)}>
                        Als extern bestellt markieren
                      </ActionButton>
                    ) : null}

                    <Link
                      href={`/bestellungen/${task.orderId}`}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Details und Rückfragen
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>
    </AppShell>
  );
}
