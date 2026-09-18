"use client";

import { useState, useTransition } from "react";
import { resetUserPasswordAction, updateUserStatusAction } from "@/lib/actions";

/** Passwort zurücksetzen und Konto sperren bzw. entsperren. */
export function UserRowActions({ userId, status, name }: { userId: string; status: string; name: string }) {
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState<string | null>(null);

  return (
    <div className="flex shrink-0 flex-col items-start gap-2 md:items-end">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await resetUserPasswordAction(userId);
              if (result.ok) {
                setPassword(result.detail ?? null);
              } else {
                window.alert(result.message ?? "Fehlgeschlagen");
              }
            })
          }
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        >
          Passwort zurücksetzen
        </button>

        <button
          type="button"
          disabled={pending}
          onClick={() => {
            const next = status === "active" ? "inactive" : "active";
            if (next === "inactive" && !window.confirm(`Konto von ${name} deaktivieren?`)) {
              return;
            }
            startTransition(async () => {
              const result = await updateUserStatusAction(userId, next);
              if (!result.ok && result.message) {
                window.alert(result.message);
              }
            });
          }}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        >
          {status === "active" ? "Deaktivieren" : "Aktivieren"}
        </button>
      </div>

      {password ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          {password}
        </p>
      ) : null}
    </div>
  );
}
