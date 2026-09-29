"use client";

import { useTransition } from "react";
import { updateLocationAction } from "@/lib/actions";
import { cn } from "@/lib/utils";

interface LocationRow {
  id: string;
  name: string;
  address: string | null;
}

/** Kurzes Formular per Prompt statt eigenem Dialog - Name und Adresse ändern sich selten. */
export function LocationRowActions({ location }: { location: LocationRow }) {
  const [pending, startTransition] = useTransition();

  function edit() {
    const name = window.prompt("Name des Standorts", location.name);
    if (name === null) {
      return;
    }
    const address = window.prompt("Adresse", location.address ?? "");
    if (address === null) {
      return;
    }

    startTransition(async () => {
      const result = await updateLocationAction(location.id, { name, address });
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
      Bearbeiten
    </button>
  );
}
