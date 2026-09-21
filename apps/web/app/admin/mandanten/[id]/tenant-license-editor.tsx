"use client";

import { useTransition } from "react";
import { setTenantLicenseAction } from "@/lib/actions";
import { cn } from "@/lib/utils";

/** Kurzes Formular per Prompt - das Kontingent ändert sich selten. */
export function TenantLicenseEditor({ tenantId, licensedSeats }: { tenantId: string; licensedSeats: number | null }) {
  const [pending, startTransition] = useTransition();

  function edit() {
    const eingabe = window.prompt(
      "Lizenzkontingent (Höchstzahl aktiver Konten) - leer lassen für unbegrenzt:",
      licensedSeats !== null ? String(licensedSeats) : "",
    );
    if (eingabe === null) {
      return;
    }
    const wert = eingabe.trim();
    if (wert && (!/^\d+$/.test(wert) || Number(wert) < 1)) {
      window.alert("Bitte eine ganze Zahl ab 1 angeben, oder leer lassen für unbegrenzt.");
      return;
    }

    startTransition(async () => {
      const result = await setTenantLicenseAction(tenantId, wert ? Number(wert) : null);
      if (!result.ok && result.message) {
        window.alert(result.message);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={edit}
      disabled={pending}
      className={cn(
        "rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50",
        pending && "cursor-not-allowed opacity-60",
      )}
    >
      Lizenzkontingent ändern
    </button>
  );
}
