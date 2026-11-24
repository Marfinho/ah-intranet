"use client";

import { useTransition } from "react";
import { setMfaPflichtAction } from "@/lib/actions";

/** Schreibt allen Konten des Hauses den zweiten Faktor vor - oder nimmt die Pflicht zurück. */
export function MfaSchalter({
  pflicht,
  eingerichtet,
  konten,
}: {
  pflicht: boolean;
  eingerichtet: number;
  konten: number;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 p-5 text-sm text-slate-600">
      <p>
        Mit einem Code aus einer Authenticator-App zusätzlich zum Passwort. Aktuell haben{" "}
        <strong className="text-slate-900">
          {eingerichtet} von {konten}
        </strong>{" "}
        aktiven Konten ihn eingerichtet.
      </p>
      <p>
        Wird er vorgeschrieben, melden sich Konten ohne Faktor weiterhin an, kommen aber nur zur Einrichtung. Niemand
        wird ausgesperrt – wer sein Telefon verliert, wird in der Benutzerverwaltung zurückgesetzt. Konten der
        Plattformverwaltung brauchen den Faktor unabhängig von dieser Einstellung.
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          const ziel = !pflicht;
          const frage = ziel
            ? `Zweiten Faktor für alle Konten vorschreiben? ${konten - eingerichtet} Konto(n) müssen ihn danach noch einrichten.`
            : "Pflicht zurücknehmen? Eingerichtete Faktoren bleiben aktiv.";
          if (!window.confirm(frage)) {
            return;
          }
          startTransition(async () => {
            const result = await setMfaPflichtAction(ziel);
            if (!result.ok && result.message) {
              window.alert(result.message);
            }
          });
        }}
        className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
      >
        {pflicht ? "Pflicht zurücknehmen" : "Für alle vorschreiben"}
      </button>
      <span
        className={pflicht ? "badge ml-3 bg-emerald-100 text-emerald-800" : "badge ml-3 bg-slate-100 text-slate-600"}
      >
        {pflicht ? "Vorgeschrieben" : "Freiwillig"}
      </span>
    </div>
  );
}
