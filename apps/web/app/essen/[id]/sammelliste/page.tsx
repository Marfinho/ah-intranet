import Link from "next/link";
import type { MealRoundup } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { EmptyState, Section } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { requireModule, requirePermission } from "@/lib/session";

function euro(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

/**
 * Sammelliste mit Namen.
 *
 * Jemand muss die Tüten verteilen - deshalb stehen hier Namen, und deshalb
 * hängt die Seite am Recht statt am Modul allein.
 */
export default async function SammellistePage({ params }: { params: { id: string } }) {
  await requireModule("meals");
  await requirePermission("meals.manage");

  const roundup = await apiGet<MealRoundup>(`/essen/angebote/${params.id}/sammelliste`);
  const datum = new Date(roundup.offer.date).toLocaleDateString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <AppShell title="Sammelliste" subtitle={`${datum} · ${roundup.offer.provider}`}>
      <Section
        title={`${roundup.lines.reduce((summe, line) => summe + line.quantity, 0)} Portionen`}
        subtitle={`Gesamt ${euro(roundup.totalCents)}`}
        action={
          <Link
            href="/essen"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Zurück
          </Link>
        }
      >
        {roundup.lines.length === 0 ? (
          <EmptyState title="Nichts bestellt" detail="Für dieses Angebot liegt keine Bestellung vor." />
        ) : (
          <div className="space-y-4">
            {roundup.lines.map((line) => (
              <div key={line.option} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-semibold text-slate-900">
                    {line.quantity}× {line.option}
                  </p>
                  <p className="text-sm text-slate-600">
                    {euro(line.priceCents)} je Portion · {euro(line.quantity * line.priceCents)}
                  </p>
                </div>
                <p className="mt-2 text-sm text-slate-600">{line.people.join(", ")}</p>
              </div>
            ))}
          </div>
        )}
      </Section>
    </AppShell>
  );
}
