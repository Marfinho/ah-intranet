import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import type { EinrichtungsSchrittStatus } from "@ah-intranet/shared";
import { cn } from "@/lib/utils";

/** Ein Punkt der Einrichtungs-Checkliste - verlinkt auf die Zielseite, erledigt visuell abgesetzt. */
export function EinrichtungsChecklistItem({ schritt }: { schritt: EinrichtungsSchrittStatus }) {
  return (
    <li>
      <Link
        href={schritt.href}
        className={cn(
          "flex items-start gap-3 rounded-2xl border p-4 transition",
          schritt.done
            ? "border-emerald-100 bg-emerald-50/60 text-slate-500"
            : "border-slate-200 hover:border-brand-100 hover:bg-slate-50",
        )}
      >
        {schritt.done ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        ) : (
          <Circle className="mt-0.5 h-5 w-5 shrink-0 text-slate-300" />
        )}
        <div className="min-w-0">
          <p className={cn("font-semibold", schritt.done ? "text-slate-600 line-through" : "text-slate-900")}>
            {schritt.titel}
            {!schritt.pflicht ? <span className="ml-2 text-xs font-normal text-slate-400">optional</span> : null}
          </p>
          <p className="mt-1 text-sm text-slate-600">{schritt.beschreibung}</p>
        </div>
      </Link>
    </li>
  );
}
