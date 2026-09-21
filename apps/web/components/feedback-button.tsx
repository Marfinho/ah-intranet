"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquarePlus } from "lucide-react";

/**
 * Rückkanal aus der laufenden Anwendung.
 *
 * Erscheint nur, solange ein Haus mindestens eine Erprobung eingeschaltet hat.
 * Wer eine unfertige Funktion benutzt, soll nicht erst überlegen müssen, wem er
 * das sagt – und die Meldung landet dort, wo Meldungen ohnehin landen, statt in
 * einem zweiten System, das niemand liest.
 *
 * Die aktuelle Seite reist als Vorbelegung mit: ohne sie beginnt jede Rückfrage
 * mit „Wo war das denn?".
 */
export function FeedbackButton() {
  const pathname = usePathname();

  return (
    <Link
      href={`/tickets?von=${encodeURIComponent(pathname)}`}
      className="ziel gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 text-sm font-semibold text-brand-700 transition hover:bg-brand-100"
    >
      <MessageSquarePlus className="h-4 w-4" />
      <span className="hidden sm:inline">Rückmeldung</span>
    </Link>
  );
}
