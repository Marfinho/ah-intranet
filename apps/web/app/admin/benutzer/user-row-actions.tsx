"use client";

import { useState, useTransition } from "react";
import {
  grantAccessAction,
  resetUserMfaAction,
  resetUserPasswordAction,
  revokeAccessAction,
  updateUserStatusAction,
} from "@/lib/actions";

const buttonClass =
  "rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60";

/** Zugang einrichten bzw. entziehen, Passwort zurücksetzen, Konto sperren oder entsperren. */
export function UserRowActions({
  userId,
  status,
  name,
  hasAccess,
}: {
  userId: string;
  status: string;
  name: string;
  hasAccess: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState<string | null>(null);

  return (
    <div className="flex shrink-0 flex-col items-start gap-2 md:items-end">
      <div className="flex flex-wrap gap-2">
        {hasAccess ? (
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
            className={buttonClass}
          >
            Passwort zurücksetzen
          </button>
        ) : null}

        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (hasAccess && !window.confirm(`Zugang von ${name} entziehen? Die Person bleibt im Personalstamm.`)) {
              return;
            }
            startTransition(async () => {
              const result = hasAccess ? await revokeAccessAction(userId) : await grantAccessAction(userId);
              if (!hasAccess && result.ok) {
                setPassword(result.detail ?? null);
              } else if (!result.ok) {
                window.alert(result.message ?? "Fehlgeschlagen");
              }
            });
          }}
          className={buttonClass}
        >
          {hasAccess ? "Zugang entziehen" : "Zugang einrichten"}
        </button>

        {hasAccess ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(`Zweiten Faktor von ${name} zurücksetzen? Die Person richtet ihn neu ein.`)) {
                return;
              }
              startTransition(async () => {
                const result = await resetUserMfaAction(userId);
                window.alert(result.ok ? (result.detail ?? "Zurückgesetzt.") : (result.message ?? "Fehlgeschlagen"));
              });
            }}
            className={buttonClass}
          >
            2. Faktor zurücksetzen
          </button>
        ) : null}

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
          className={buttonClass}
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
