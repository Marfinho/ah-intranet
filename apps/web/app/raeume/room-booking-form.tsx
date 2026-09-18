"use client";

import { useFormState } from "react-dom";
import type { Room } from "@ah-intranet/shared";
import { Field, FormAlert, SubmitButton, inputClass } from "@/components/forms";
import { bookRoomAction, type ActionState } from "@/lib/actions";
import { toLocalInput } from "@/lib/utils";

const initialState: ActionState = { ok: true };

export function RoomBookingForm({ rooms }: { rooms: Room[] }) {
  const [state, formAction] = useFormState(bookRoomAction, initialState);

  const start = new Date();
  start.setHours(start.getHours() + 1, 0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2">
      <Field label="Raum *">
        <select name="roomId" required className={inputClass}>
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>
              {room.name} ({room.capacity} Plätze)
            </option>
          ))}
        </select>
      </Field>

      <Field label="Zweck *">
        <input name="title" required minLength={3} className={inputClass} placeholder="z. B. Teambesprechung" />
      </Field>

      <Field label="Von *">
        <input name="startsAt" type="datetime-local" required defaultValue={toLocalInput(start)} className={inputClass} />
      </Field>

      <Field label="Bis *">
        <input name="endsAt" type="datetime-local" required defaultValue={toLocalInput(end)} className={inputClass} />
      </Field>

      <div className="md:col-span-2">
        <FormAlert state={state} />
      </div>

      <div className="md:col-span-2">
        <SubmitButton>Raum buchen</SubmitButton>
      </div>
    </form>
  );
}
