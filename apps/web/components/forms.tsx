"use client";

import { ReactNode, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";
import type { ActionState } from "@/lib/actions";

export function SubmitButton({
  children,
  variant = "primary",
}: {
  children: ReactNode;
  variant?: "primary" | "ghost";
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary"
          ? "bg-brand-600 text-white hover:bg-brand-700"
          : "border border-slate-200 text-slate-700 hover:bg-slate-50",
      )}
    >
      {pending ? "Wird gespeichert …" : children}
    </button>
  );
}

/** Rückmeldung einer Server Action - Fehler rot, Erfolg grün. */
export function FormAlert({ state }: { state: ActionState }) {
  if (state.ok && !state.detail) {
    return null;
  }
  if (!state.ok && !state.message) {
    return null;
  }

  return (
    <div
      role="status"
      className={cn(
        "rounded-2xl border px-4 py-3 text-sm",
        state.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800",
      )}
    >
      {state.ok ? state.detail : state.message}
    </div>
  );
}

/**
 * Knopf, der eine Server Action ohne Formular auslöst (Freigeben, Abstimmen,
 * Status setzen). Blockiert während der Übertragung und zeigt Fehler an.
 */
export function ActionButton({
  action,
  children,
  variant = "primary",
  confirm,
  className,
}: {
  action: () => Promise<ActionState>;
  children: ReactNode;
  variant?: "primary" | "danger" | "success" | "ghost";
  confirm?: string;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();

  const styles = {
    primary: "bg-brand-600 text-white hover:bg-brand-700",
    danger: "bg-rose-600 text-white hover:bg-rose-700",
    success: "bg-emerald-600 text-white hover:bg-emerald-700",
    ghost: "border border-slate-200 text-slate-700 hover:bg-slate-50",
  } as const;

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) {
          return;
        }
        startTransition(async () => {
          const result = await action();
          if (!result.ok && result.message) {
            window.alert(result.message);
          }
        });
      }}
      className={cn(
        "rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
        styles[variant],
        className,
      )}
    >
      {pending ? "…" : children}
    </button>
  );
}

export function Field({
  label,
  children,
  hint,
  wide,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  wide?: boolean;
}) {
  return (
    <label className={cn("text-sm font-medium text-slate-700", wide && "md:col-span-2")}>
      {label}
      {children}
      {hint ? <span className="mt-1 block text-xs font-normal text-slate-500">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  "mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-brand-600 focus:ring-2";
