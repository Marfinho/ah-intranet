import Link from "next/link";
import { notFound } from "next/navigation";
import type { BusinessCardOrderDetail, WorkwearOrderDetail } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { InfoList, Section, StatusBadge } from "@/components/ui";
import { Timeline } from "@/components/timeline";
import { CommentForm } from "@/components/comment-form";
import { ActionButton } from "@/components/forms";
import { ApiError, apiGet } from "@/lib/api";
import { isManaging, requireModule } from "@/lib/session";
import { orderCommentAction, orderTransitionAction } from "@/lib/actions";
import { formatDate, formatDateTime } from "@/lib/utils";

type OrderDetail = BusinessCardOrderDetail | WorkwearOrderDetail;

function isBusinessCard(order: OrderDetail): order is BusinessCardOrderDetail {
  return order.type === "business_card";
}

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const session = await requireModule("orders");

  let order: OrderDetail;
  try {
    order = await apiGet<OrderDetail>(`/orders/${params.id}`);
  } catch (error) {
    if (error instanceof ApiError && (error.isMissing || error.status === 403)) {
      notFound();
    }
    throw error;
  }

  const manage = isManaging(session);
  const isOwner = order.employeeUsername === session.username;
  const canCancel = isOwner && ["draft", "submitted", "approved"].includes(order.status);

  return (
    <AppShell title={order.orderNumber} subtitle={order.summary}>
      <Section
        title="Bestelldetails"
        subtitle={`${order.employee} · ${order.scope}`}
        action={
          <div className="flex items-center gap-3">
            <StatusBadge status={order.status} />
            <Link href="/bestellungen/meine" className="text-sm font-semibold text-brand-700 hover:underline">
              Übersicht
            </Link>
          </div>
        }
      >
        <InfoList
          items={[
            { label: "Bestellnummer", value: order.orderNumber },
            { label: "Erstellt am", value: formatDate(order.createdAt) },
            { label: "Eingereicht am", value: order.submittedAt ? formatDate(order.submittedAt) : "–" },
            { label: "Nächste Sammelbestellung", value: order.nextCycle ? formatDate(order.nextCycle) : "–" },
          ]}
        />

        <div className="mt-6">
          <p className="mb-3 text-sm font-semibold text-slate-900">
            {isBusinessCard(order) ? `Angaben (Auflage ${order.requestedQuantity} Stück)` : "Positionen"}
          </p>

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  {isBusinessCard(order) ? (
                    <>
                      <th className="px-4 py-3 font-semibold">Feld</th>
                      <th className="px-4 py-3 font-semibold">Wert</th>
                    </>
                  ) : (
                    <>
                      <th className="px-4 py-3 font-semibold">Artikel</th>
                      <th className="px-4 py-3 font-semibold">Größe</th>
                      <th className="px-4 py-3 font-semibold">Menge</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {isBusinessCard(order)
                  ? order.fields.map((field) => (
                      <tr key={field.key}>
                        <td className="px-4 py-3 text-slate-600">{field.label}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">{field.value}</td>
                      </tr>
                    ))
                  : order.items.map((item) => (
                      <tr key={`${item.catalogItemId}-${item.size}`}>
                        <td className="px-4 py-3 font-medium text-slate-900">{item.itemName}</td>
                        <td className="px-4 py-3 text-slate-600">{item.size}</td>
                        <td className="px-4 py-3 text-slate-600">{item.quantity}</td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </div>

        {manage || canCancel ? (
          <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-100 pt-5">
            {manage && order.status === "submitted" ? (
              <>
                <ActionButton
                  variant="success"
                  action={orderTransitionAction.bind(null, order.id, "approved", undefined)}
                >
                  Genehmigen
                </ActionButton>
                <ActionButton
                  variant="danger"
                  confirm="Bestellung wirklich ablehnen?"
                  action={orderTransitionAction.bind(null, order.id, "rejected", undefined)}
                >
                  Ablehnen
                </ActionButton>
              </>
            ) : null}

            {manage && order.status === "approved" ? (
              <ActionButton action={orderTransitionAction.bind(null, order.id, "queued_for_bulk_order", undefined)}>
                Für Sammelbestellung vormerken
              </ActionButton>
            ) : null}

            {manage && order.status === "queued_for_bulk_order" ? (
              <ActionButton action={orderTransitionAction.bind(null, order.id, "ordered", undefined)}>
                Als extern bestellt markieren
              </ActionButton>
            ) : null}

            {manage && order.status === "ordered" ? (
              <ActionButton
                variant="success"
                action={orderTransitionAction.bind(null, order.id, "completed", undefined)}
              >
                Abschließen
              </ActionButton>
            ) : null}

            {canCancel ? (
              <ActionButton
                variant="ghost"
                confirm="Bestellung stornieren?"
                action={orderTransitionAction.bind(null, order.id, "cancelled", undefined)}
              >
                Stornieren
              </ActionButton>
            ) : null}
          </div>
        ) : null}
      </Section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Verlauf" subtitle="Jeder Statuswechsel wird protokolliert">
          <Timeline
            entries={order.timeline.map((entry) => ({
              timestamp: formatDateTime(entry.timestamp),
              title: entry.title,
              detail: entry.detail,
              actor: entry.actor ?? undefined,
            }))}
          />
        </Section>

        <Section
          title={`Rückfragen (${order.comments.length})`}
          subtitle="Abstimmung zwischen Fachbereich und Besteller"
        >
          <div className="space-y-4">
            {order.comments.length > 0 ? (
              <ul className="space-y-3">
                {order.comments.map((comment) => (
                  <li key={comment.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900">{comment.author}</span>
                      <span className="text-xs text-slate-500">{formatDateTime(comment.createdAt)}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">{comment.message}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-600">Noch keine Rückfragen.</p>
            )}

            <CommentForm action={orderCommentAction.bind(null, order.id)} placeholder="Rückfrage oder Hinweis …" />
          </div>
        </Section>
      </div>
    </AppShell>
  );
}
