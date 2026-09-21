"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { EinrichtungStatusPayload, EinrichtungVariante } from "@ah-intranet/shared";
import { markEinrichtungWelcomeSeenAction, skipEinrichtungAction } from "@/lib/actions";

const TEXTE: Record<EinrichtungVariante, { titel: string; text: string; aktion: string }> = {
  gruppenadmin: {
    titel: "Willkommen bei AHOI",
    text: "In rund 15 Minuten steht das Grundsetup: Organisationsdaten, ein Standort, die ersten Mitarbeitenden und eine erste Nachricht. Jeder Schritt ist überspringbar und später über das Dashboard fortsetzbar.",
    aktion: "Einrichtung starten",
  },
  standortleitung: {
    titel: "Willkommen bei AHOI",
    text: "Ein kurzer Überblick: wo Aktuelles steht, wo offene Freigaben und Aufgaben warten, und welche Module für Ihren Bereich wichtig sind.",
    aktion: "Überblick ansehen",
  },
  mitarbeiter: {
    titel: "Willkommen bei AHOI",
    text: "Ein kurzer Überblick: Aktuelles, Ihre eigenen Anträge und wie Sie Ihr Profil und Passwort pflegen.",
    aktion: "Arbeitsbereich entdecken",
  },
};

/**
 * Erscheint nach dem ersten Login, solange der Backend-Status
 * `!willkommenGezeigt && !abgeschlossen && !uebersprungen` meldet. Der
 * Backend-Status ist die Quelle der Wahrheit - kein reines `localStorage`-Flag,
 * damit der Dialog nach einem Serverneustart oder auf einem anderen Gerät
 * nicht erneut aufreißt.
 */
export function EinrichtungsWillkommenDialog({ status }: { status: EinrichtungStatusPayload | null }) {
  const [verborgen, setVerborgen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (!status || verborgen || status.willkommenGezeigt || status.abgeschlossen || status.uebersprungen) {
    return null;
  }

  const text = TEXTE[status.variante];

  const schliessen = (weiter: () => Promise<unknown>) => {
    setVerborgen(true);
    startTransition(async () => {
      await weiter();
      router.refresh();
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="einrichtung-willkommen-titel"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
    >
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-card">
        <p className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-600">
          Erste Schritte
        </p>
        <h2 id="einrichtung-willkommen-titel" className="mt-2 text-xl font-bold text-slate-900">
          {text.titel}
        </h2>
        <p className="mt-3 text-sm text-slate-600">{text.text}</p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={isPending}
            onClick={() => schliessen(() => markEinrichtungWelcomeSeenAction())}
            className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {text.aktion}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => schliessen(() => skipEinrichtungAction())}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Überspringen
          </button>
        </div>
      </div>
    </div>
  );
}
