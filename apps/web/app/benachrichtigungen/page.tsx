import Link from "next/link";
import type { NotificationItem } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { ActionButton } from "@/components/forms";
import { EmptyState, Section } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/lib/actions";
import { cn, formatDateTime } from "@/lib/utils";

export default async function NotificationsPage({ searchParams }: { searchParams: { unread?: string } }) {
  await requireSession();

  const onlyUnread = searchParams.unread === "true";
  const items = await apiGet<NotificationItem[]>(`/notifications${onlyUnread ? "?unread=true" : ""}`);
  const unreadCount = items.filter((item) => !item.read).length;

  return (
    <AppShell title="Benachrichtigungen" subtitle="Ereignisse aus Freigaben, Bestellungen, Tickets und News">
      <Section
        title={`${items.length} Meldungen`}
        subtitle={`${unreadCount} davon ungelesen`}
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={onlyUnread ? "/benachrichtigungen" : "/benachrichtigungen?unread=true"}
              className="text-sm font-semibold text-brand-700 hover:underline"
            >
              {onlyUnread ? "Alle anzeigen" : "Nur ungelesene"}
            </Link>
            {unreadCount > 0 ? (
              <ActionButton variant="ghost" action={markAllNotificationsReadAction}>
                Alle als gelesen markieren
              </ActionButton>
            ) : null}
          </div>
        }
      >
        {items.length === 0 ? (
          <EmptyState title="Keine Benachrichtigungen" detail="Hier erscheinen Ereignisse aus Ihren Modulen." />
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li
                key={item.id}
                className={cn(
                  "rounded-2xl border p-5",
                  item.read ? "border-slate-200" : "border-brand-100 bg-brand-50/40",
                )}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">{item.title}</span>
                      {!item.read ? <span className="badge bg-brand-600 text-white">neu</span> : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{item.detail}</p>
                    <p className="mt-2 text-xs text-slate-500">{formatDateTime(item.createdAt)}</p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-3">
                    {item.link ? (
                      <Link
                        href={item.link}
                        className="ziel rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Öffnen
                      </Link>
                    ) : null}
                    {!item.read ? (
                      <ActionButton variant="ghost" action={markNotificationReadAction.bind(null, item.id)}>
                        Gelesen
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
