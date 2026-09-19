import type { MealOfferItem } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { EmptyState, Section, Tag } from "@/components/ui";
import { MealOfferComposer } from "./offer-composer";
import { MealOrderActions } from "./order-actions";
import { apiGet } from "@/lib/api";
import { can, requireModule } from "@/lib/session";

interface Organisation {
  locations: { id: string; name: string }[];
}

function euro(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function tag(wert: string): string {
  return new Date(wert).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit" });
}

function uhrzeit(wert: string): string {
  return new Date(wert).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

export default async function EssenPage() {
  const session = await requireModule("meals");
  const darfPflegen = can(session, "meals.manage");

  const [offers, organisation] = await Promise.all([
    apiGet<MealOfferItem[]>("/essen"),
    darfPflegen ? apiGet<Organisation>("/users/organisation") : Promise.resolve({ locations: [] }),
  ]);

  return (
    <AppShell title="Essensbestellung" subtitle="Tagesangebot, Stichtag und Sammelliste für die Abholung">
      {darfPflegen ? (
        <Section title="Angebot anlegen" subtitle="Nach dem Stichtag nimmt die Sammelliste nichts mehr an">
          <MealOfferComposer organisation={organisation} />
        </Section>
      ) : null}

      {offers.length === 0 ? (
        <Section title="Kein Angebot" subtitle="Für die nächsten Tage ist nichts eingetragen">
          <EmptyState title="Nichts im Angebot" detail="Sobald jemand ein Tagesangebot einträgt, steht es hier." />
        </Section>
      ) : (
        offers.map((offer) => (
          <Section
            key={offer.id}
            title={`${tag(offer.date)} · ${offer.provider}`}
            subtitle={
              offer.closed
                ? `Stichtag war um ${uhrzeit(offer.orderDeadline)} Uhr – die Bestellung ist raus`
                : `Bestellbar bis ${uhrzeit(offer.orderDeadline)} Uhr${offer.location ? ` · ${offer.location}` : ""}`
            }
          >
            <div className="space-y-4">
              {offer.note ? <p className="text-sm text-slate-600">{offer.note}</p> : null}

              <div className="flex flex-wrap items-center gap-2">
                {offer.closed ? <Tag>Geschlossen</Tag> : null}
                {offer.myOrder ? (
                  <span className="badge bg-emerald-100 text-emerald-800">
                    Ihre Wahl: {offer.options.find((option) => option.id === offer.myOrder?.optionId)?.name}
                    {offer.myOrder.quantity > 1 ? ` × ${offer.myOrder.quantity}` : ""}
                  </span>
                ) : (
                  <span className="badge bg-slate-100 text-slate-600">Noch nicht bestellt</span>
                )}
              </div>

              <MealOrderActions offer={offer} darfPflegen={darfPflegen} />

              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Wahl</th>
                      <th className="px-4 py-3 font-semibold">Preis</th>
                      <th className="px-4 py-3 font-semibold">Bestellt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {offer.options.map((option) => (
                      <tr key={option.id}>
                        <td className="px-4 py-3">
                          <span className="font-medium text-slate-900">{option.name}</span>
                          {option.description ? (
                            <span className="block text-slate-500">{option.description}</span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{euro(option.priceCents)}</td>
                        <td className="px-4 py-3 text-slate-700">{option.count}×</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Section>
        ))
      )}
    </AppShell>
  );
}
