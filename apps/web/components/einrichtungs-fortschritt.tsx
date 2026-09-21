import type { EinrichtungsSchrittStatus } from "@ah-intranet/shared";
import { berechneFortschritt } from "@ah-intranet/shared";
import { ProgressBar } from "@/components/ui";

/** Zeigt "X von Y Schritten erledigt" mit Balken - reine Anzeige, keine Aktion. */
export function EinrichtungsFortschritt({ schritte }: { schritte: EinrichtungsSchrittStatus[] }) {
  const { erledigt, gesamt } = berechneFortschritt(schritte);

  if (gesamt === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700">
          {erledigt} von {gesamt} Schritten erledigt
        </span>
      </div>
      <ProgressBar value={erledigt} max={gesamt} />
    </div>
  );
}
