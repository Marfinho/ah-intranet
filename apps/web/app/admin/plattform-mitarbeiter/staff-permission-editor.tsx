"use client";

import { useState, useTransition } from "react";
import { PLATFORM_PERMISSION_BEREICHE, PLATFORM_PERMISSION_DEFINITIONS } from "@ah-intranet/shared";
import type { PlatformStaffSummary } from "@ah-intranet/shared";
import { setPlatformPermissionsAction } from "@/lib/actions";
import { cn } from "@/lib/utils";

/**
 * Ein Konto mit Plattformbezug und seine Rechte.
 *
 * Chips statt Auswahlliste - derselbe Aufbau wie bei den Hausrollen
 * (`role-permission-editor.tsx`), nur ohne Rollen: bei den wenigen Personen,
 * die den Service machen, lohnt sich der Umweg über eine eigene Rollenebene
 * nicht, jedes Konto bekommt seine Rechte direkt.
 */
export function StaffPermissionEditor({ staff }: { staff: PlatformStaffSummary }) {
  const [selected, setSelected] = useState<string[]>(staff.platformPermissions);
  const [pending, startTransition] = useTransition();

  const geaendert =
    selected.length !== staff.platformPermissions.length ||
    selected.some((key) => !staff.platformPermissions.includes(key));

  return (
    <div className="rounded-2xl border border-slate-200 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{staff.displayName}</p>
          <p className="mt-1 text-sm text-slate-600">
            {staff.username} · {staff.tenant.name}
          </p>
        </div>
        {staff.isPlatformAdmin ? <span className="badge bg-brand-50 text-brand-700">Betreiber</span> : null}
      </div>

      {staff.isPlatformAdmin ? (
        <p className="mt-4 text-sm text-slate-500">
          Trägt als Plattformverwaltung bereits alle Rechte - eine Einzelfreischaltung ist überflüssig.
        </p>
      ) : (
        <>
          <div className="mt-4 space-y-4">
            {PLATFORM_PERMISSION_BEREICHE.map((bereich) => {
              const gruppe = PLATFORM_PERMISSION_DEFINITIONS.filter((permission) => permission.bereich === bereich);
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

          {geaendert ? (
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await setPlatformPermissionsAction(staff.id, selected);
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
                onClick={() => setSelected(staff.platformPermissions)}
                className="text-sm font-semibold text-slate-600 hover:underline"
              >
                Zurücksetzen
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
