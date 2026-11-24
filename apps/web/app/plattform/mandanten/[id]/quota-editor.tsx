"use client";

import { useTransition } from "react";
import type { ActionState } from "@/lib/actions";
import { cn } from "@/lib/utils";

/** Kurzes Formular per Prompt - ein Kontingent ändert sich selten. Gemeinsam für Lizenzen und Standortlimit. */
export function QuotaEditor({
  label,
  promptText,
  value,
  action,
}: {
  label: string;
  promptText: string;
  value: number | null;
  action: (value: number | null) => Promise<ActionState>;
}) {
  const [pending, startTransition] = useTransition();

  function edit() {
    const eingabe = window.prompt(promptText, value !== null ? String(value) : "");
    if (eingabe === null) {
      return;
    }
    const wert = eingabe.trim();
    if (wert && (!/^\d+$/.test(wert) || Number(wert) < 1)) {
      window.alert("Bitte eine ganze Zahl ab 1 angeben, oder leer lassen für unbegrenzt.");
      return;
    }

    startTransition(async () => {
      const result = await action(wert ? Number(wert) : null);
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
      {label}
    </button>
  );
}
