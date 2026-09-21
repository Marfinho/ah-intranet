import { zielgruppenLabel } from "@ah-intranet/shared";
import type { ZielgruppenKatalog } from "@ah-intranet/shared";
import { Users } from "lucide-react";

/**
 * Zeigt, an wen ein Inhalt geht - in Klartext, nicht als Token.
 *
 * „location:HB+department:SRV" steht am Beitrag, ist aber für niemanden zu
 * lesen. Wer veröffentlicht, muss vor dem Absenden sehen, wen er erreicht;
 * wer liest, soll erkennen, ob eine Information für das ganze Haus gilt oder
 * nur für die eigene Abteilung.
 */
export function ZielgruppeAnzeige({
  scopes,
  katalog,
  className,
}: {
  scopes: string[];
  katalog: ZielgruppenKatalog;
  className?: string;
}) {
  return (
    <span className={className ?? "inline-flex items-center gap-1 text-xs text-slate-600"}>
      <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="sr-only">Zielgruppe: </span>
      {zielgruppenLabel(scopes, katalog)}
    </span>
  );
}
