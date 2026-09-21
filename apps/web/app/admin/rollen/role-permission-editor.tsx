"use client";

import { useState, useTransition } from "react";
import type { PermissionSummary, RoleSummary } from "@ah-intranet/shared";
import { deleteRoleAction, setRolePermissionsAction, updateRoleAction } from "@/lib/actions";
import { cn } from "@/lib/utils";

/**
 * Eine Rolle mit ihren Rechten.
 *
 * Die Rechte stehen nach Bereichen gruppiert - bei zwanzig Schaltern ist eine
 * flache Reihe nicht mehr lesbar. Rollen der Grundausstattung lassen sich in
 * allem ändern außer im Löschen.
 */
export function RolePermissionEditor({
  role,
  permissions,
  bereiche,
}: {
  role: RoleSummary;
  permissions: PermissionSummary[];
  bereiche: string[];
}) {
  const [selected, setSelected] = useState<string[]>(role.permissions);
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description);
  const [rank, setRank] = useState(role.rank);
  const [offen, setOffen] = useState(false);
  const [pending, startTransition] = useTransition();

  const rechteGeaendert =
    selected.length !== role.permissions.length || selected.some((key) => !role.permissions.includes(key));
  const stammGeaendert = name !== role.name || description !== role.description || rank !== role.rank;

  const melde = (result: { ok: boolean; message?: string }) => {
    if (!result.ok && result.message) {
      window.alert(result.message);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{role.name}</p>
          <p className="mt-1 text-sm text-slate-600">{role.description}</p>
          <p className="mt-1 font-mono text-xs text-slate-400">{role.key}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge bg-slate-100 text-slate-600">{role.userCount} Personen</span>
          <span className="badge bg-slate-100 text-slate-600">Rang {role.rank}</span>
          {role.isSystem ? <span className="badge bg-slate-100 text-slate-600">Grundausstattung</span> : null}
          <button
            type="button"
            onClick={() => setOffen((wert) => !wert)}
            className="text-sm font-semibold text-slate-600 hover:underline"
          >
            {offen ? "Stammdaten schließen" : "Stammdaten"}
          </button>
        </div>
      </div>

      {offen ? (
        <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 md:grid-cols-[2fr,3fr,auto]">
          <label className="text-sm">
            <span className="font-medium text-slate-700">Name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="font-medium text-slate-700">Beschreibung</span>
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="font-medium text-slate-700">Rang</span>
            <input
              type="number"
              min={0}
              max={99}
              value={rank}
              onChange={(event) => setRank(Number(event.target.value))}
              className="mt-1 w-24 rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </label>

          <div className="flex flex-wrap items-center gap-3 md:col-span-3">
            <button
              type="button"
              disabled={pending || !stammGeaendert}
              onClick={() =>
                startTransition(async () => melde(await updateRoleAction(role.id, { name, description, rank })))
              }
              className="ziel rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-40"
            >
              Stammdaten speichern
            </button>
            {role.isSystem ? (
              <span className="text-xs text-slate-500">
                Rollen der Grundausstattung lassen sich nicht löschen – ihre Rechte können Sie frei ändern.
              </span>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (window.confirm(`Rolle "${role.name}" wirklich löschen?`)) {
                    startTransition(async () => melde(await deleteRoleAction(role.id)));
                  }
                }}
                className="text-sm font-semibold text-red-700 hover:underline disabled:opacity-40"
              >
                Rolle löschen
              </button>
            )}
          </div>
        </div>
      ) : null}

      <div className="mt-4 space-y-4">
        {bereiche.map((bereich) => {
          const gruppe = permissions.filter((permission) => permission.bereich === bereich);
          if (gruppe.length === 0) {
            return null;
          }
          return (
            <div key={bereich}>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{bereich}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {gruppe.map((permission) => {
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
            </div>
          );
        })}
      </div>

      {rechteGeaendert ? (
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(async () => melde(await setRolePermissionsAction(role.id, selected)))}
            className="ziel rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
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
