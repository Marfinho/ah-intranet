"use client";

import { useActionState } from "react";
import { FormAlert, SubmitButton, inputClass } from "@/components/forms";
import type { ActionState } from "@/lib/actions";

const initialState: ActionState = { ok: true };

/** Wiederverwendbares Kommentarfeld für News, Bestellungen und Tickets. */
export function CommentForm({
  action,
  placeholder = "Nachricht schreiben …",
  label = "Senden",
}: {
  action: (previous: ActionState, formData: FormData) => Promise<ActionState>;
  placeholder?: string;
  label?: string;
}) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <textarea name="message" rows={3} placeholder={placeholder} required className={inputClass} />
      <FormAlert state={state} />
      <SubmitButton>{label}</SubmitButton>
    </form>
  );
}
