"use client";

import { useTransition } from "react";
import type { TenantSummary } from "@ah-intranet/shared";
import { setTenantActiveAction } from "@/lib/actions";
import { cn } from "@/lib/utils";

/**
 * Freischalten und Sperren. Gelöscht wird nichts: Aufbewahrungsfristen laufen
 * weiter, auch wenn ein Haus nicht mehr Kunde ist.
 */
export function TenantRowActions({ tenant, self }: { tenant: TenantSummary; self: boolean }) {
  const [pending, startTransition] = useTransition();

  function toggle() {
    if (tenant.isActive) {
      const confirmed = window.confirm(
        `„${tenant.name}" sperren?\n\nAlle ${tenant.userCount} Konten dieses Hauses können sich danach nicht mehr anmelden. Die Daten bleiben erhalten.`,
      );
      if (!confirmed) {
        return;
      }
    }

    startTransition(async () => {
      const result = await setTenantActiveAction(tenant.id, !tenant.isActive);
      if (!result.ok && result.message) {
        window.alert(result.message);
      }
    });
  }

  if (self) {
    return <span className="text-xs text-slate-500">eigenes Haus</span>;
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={cn(
        "rounded-xl px-3 py-1.5 text-sm font-semibold transition",
        tenant.isActive ? "bg-rose-50 text-rose-700 hover:bg-rose-100" : "bg-brand-600 text-white hover:bg-brand-700",
        pending && "cursor-not-allowed opacity-60",
      )}
    >
      {tenant.isActive ? "Sperren" : "Freischalten"}
    </button>
  );
}
