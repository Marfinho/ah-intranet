"use client";

import { useFormState } from "react-dom";
import { useTransition } from "react";
import type { ShiftSwapItem } from "@ah-intranet/shared";
import { Field, FormAlert, SubmitButton, inputClass } from "@/components/forms";
import {
  decideSwapAction,
  requestSwapAction,
  respondSwapAction,
  withdrawSwapAction,
  type ActionState,
} from "@/lib/actions";

const initialState: ActionState = { ok: true };

/** Eine Schicht abgeben: an wen, mit welcher Begründung. */
export function SwapComposer({
  shifts,
  people,
}: {
  shifts: { id: string; label: string }[];
  people: { id: string; name: string }[];
}) {
  const [state, formAction] = useFormState(requestSwapAction, initialState);

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2">
      <Field label="Schicht *">
        <select name="shiftId" required className={inputClass}>
          {shifts.map((shift) => (
            <option key={shift.id} value={shift.id}>
              {shift.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Wen fragen? *">
        <select name="targetId" required className={inputClass}>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Grund" wide hint="Hilft der angefragten Person bei der Entscheidung">
        <input name="note" className={inputClass} placeholder="z. B. Arzttermin am Vormittag" />
      </Field>

      <div className="md:col-span-2">
        <FormAlert state={state} />
      </div>

      <div className="md:col-span-2">
        <SubmitButton>Anfrage senden</SubmitButton>
      </div>
    </form>
  );
}

/** Die Schaltflächen, die zum jeweiligen Zustand und zur Person passen. */
export function SwapActions({ swap }: { swap: ShiftSwapItem }) {
  const [pending, startTransition] = useTransition();

  const melde = (result: ActionState) => {
    if (!result.ok && result.message) {
      window.alert(result.message);
    }
  };

  if (!swap.canRespond && !swap.canDecide && !swap.canWithdraw) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
      {swap.canRespond ? (
        <>
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(async () => melde(await respondSwapAction(swap.id, true)))}
            className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Übernehme ich
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(async () => melde(await respondSwapAction(swap.id, false)))}
            className="text-sm font-semibold text-slate-600 hover:underline disabled:opacity-50"
          >
            Geht bei mir nicht
          </button>
        </>
      ) : null}

      {swap.canDecide ? (
        <>
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(async () => melde(await decideSwapAction(swap.id, true)))}
            className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Tausch freigeben
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              const grund = window.prompt("Warum wird der Tausch nicht freigegeben?") ?? undefined;
              startTransition(async () => melde(await decideSwapAction(swap.id, false, grund)));
            }}
            className="text-sm font-semibold text-red-700 hover:underline disabled:opacity-50"
          >
            Nicht freigeben
          </button>
        </>
      ) : null}

      {swap.canWithdraw ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(async () => melde(await withdrawSwapAction(swap.id)))}
          className="text-sm font-semibold text-slate-600 hover:underline disabled:opacity-50"
        >
          Anfrage zurückziehen
        </button>
      ) : null}
    </div>
  );
}
