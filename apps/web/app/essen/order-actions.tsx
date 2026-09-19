"use client";

import { useTransition } from "react";
import type { MealOfferItem } from "@ah-intranet/shared";
import { cancelMealAction, deleteMealOfferAction, orderMealAction, type ActionState } from "@/lib/actions";
import { cn } from "@/lib/utils";

/** Bestellen ist ein Klick auf die Wahl; eine zweite Wahl ersetzt die erste. */
export function MealOrderActions({ offer, darfPflegen }: { offer: MealOfferItem; darfPflegen: boolean }) {
  const [pending, startTransition] = useTransition();

  const melde = (result: ActionState) => {
    if (!result.ok && result.message) {
      window.alert(result.message);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!offer.closed
        ? offer.options.map((option) => {
            const gewaehlt = offer.myOrder?.optionId === option.id;
            return (
              <button
                key={option.id}
                type="button"
                disabled={pending}
                onClick={() => startTransition(async () => melde(await orderMealAction(offer.id, option.id)))}
                className={cn(
                  "rounded-xl border px-3 py-2 text-sm font-medium transition disabled:opacity-50",
                  gewaehlt
                    ? "border-brand-600 bg-brand-50 text-brand-800"
                    : "border-slate-200 text-slate-700 hover:bg-slate-50",
                )}
              >
                {option.name}
              </button>
            );
          })
        : null}

      {offer.myOrder && !offer.closed ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(async () => melde(await cancelMealAction(offer.id)))}
          className="text-sm font-semibold text-slate-600 hover:underline disabled:opacity-50"
        >
          Abbestellen
        </button>
      ) : null}

      {darfPflegen ? (
        <>
          <a
            href={`/essen/${offer.id}/sammelliste`}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Sammelliste
          </a>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (window.confirm("Angebot wirklich entfernen?")) {
                startTransition(async () => melde(await deleteMealOfferAction(offer.id)));
              }
            }}
            className="text-sm font-semibold text-red-700 hover:underline disabled:opacity-50"
          >
            Angebot entfernen
          </button>
        </>
      ) : null}
    </div>
  );
}
