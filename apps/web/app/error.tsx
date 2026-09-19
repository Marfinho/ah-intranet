"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md rounded-3xl bg-white p-8 text-center shadow-card">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-rose-600">Unerwarteter Fehler</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Da ist etwas schiefgelaufen</h1>
        <p className="mt-2 text-sm text-slate-600">
          Bitte versuchen Sie es erneut. Bleibt der Fehler bestehen, melden Sie ihn bitte der IT.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Erneut versuchen
        </button>
      </div>
    </div>
  );
}
