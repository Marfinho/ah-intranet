"use client";

import { useFormState } from "react-dom";
import { useTransition } from "react";
import { FormAlert, SubmitButton } from "@/components/forms";
import { Signet } from "@/components/logo";
import { removeLogoAction, uploadLogoAction, type ActionState } from "@/lib/actions";

const initialState: ActionState = { ok: true };

export function LogoUploader({ hasLogo }: { hasLogo: boolean }) {
  const [state, formAction] = useFormState(uploadLogoAction, initialState);
  const [pending, startTransition] = useTransition();

  function entfernen() {
    if (!window.confirm("Eigenes Logo entfernen? Danach gilt wieder das AHOI-Zeichen.")) {
      return;
    }
    startTransition(async () => {
      const result = await removeLogoAction();
      if (!result.ok && result.message) {
        window.alert(result.message);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 p-1 text-slate-900">
          <Signet className="h-9 w-9" />
        </div>
        <p className="text-sm text-slate-600">
          {hasLogo
            ? "Eigenes Logo ist hinterlegt und ersetzt das AHOI-Zeichen in diesem Haus."
            : "Kein eigenes Logo hinterlegt - es gilt das AHOI-Zeichen."}
        </p>
      </div>

      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium text-slate-700">
          Neue Datei
          <input
            name="file"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            required
            className="mt-2 block text-sm text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-brand-700"
          />
          <span className="mt-1 block text-xs font-normal text-slate-500">PNG, JPEG oder WebP, höchstens 2 MB</span>
        </label>
        <SubmitButton>Hochladen</SubmitButton>
      </form>
      <FormAlert state={state} />

      {hasLogo ? (
        <button
          type="button"
          onClick={entfernen}
          disabled={pending}
          className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Eigenes Logo entfernen
        </button>
      ) : null}
    </div>
  );
}
