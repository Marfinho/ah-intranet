"use client";

import { useState, useTransition } from "react";
import type { PermissionSummary, RoleSummary } from "@ah-intranet/shared";
import { setRolePermissionsAction } from "@/lib/actions";
import { cn } from "@/lib/utils";

/** Berechtigungen einer Rolle als Mehrfachauswahl, gespeichert in einem Rutsch. */
export function RolePermissionEditor({ role, permissions }: { role: RoleSummary; permissions: PermissionSummary[] }) {
  const [selected, setSelected] = useState<string[]>(role.permissions);
  const [pending, startTransition] = useTransition();

  const changed =
    selected.length !== role.permissions.length || selected.some((key) => !role.permissions.includes(key));

  return (
    <div className="rounded-2xl border border-slate-200 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900">{role.name}</p>
          <p className="mt-1 text-sm text-slate-600">{role.description}</p>
        </div>
        <span className="badge bg-slate-100 text-slate-600">{role.userCount} Personen</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {permissions.map((permission) => {
          const active = selected.includes(permission.key);
          return (
            <button
              key={permission.key}
              type="button"
              title={permission.description}
              onClick={() =>
                setSelected((current) =>
                  current.includes(permission.key)
                    ? current.filter((entry) => entry !== permission.key)
                    : [...current, permission.key],
                )
              }
              className={cn(
                "rounded-xl border px-3 py-2 text-xs font-medium transition",
                active
                  ? "border-brand-600 bg-brand-50 text-brand-800"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50",
              )}
            >
              {permission.name}
            </button>
          );
        })}
      </div>

      {changed ? (
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await setRolePermissionsAction(role.id, selected);
                if (!result.ok && result.message) {
                  window.alert(result.message);
                }
              })
            }
            className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {pending ? "Speichert …" : "Rechte speichern"}
          </button>
          <button
            type="button"
            onClick={() => setSelected(role.permissions)}
            className="text-sm font-semibold text-slate-600 hover:underline"
          >
            Zurücksetzen
          </button>
        </div>
      ) : null}
    </div>
  );
}
