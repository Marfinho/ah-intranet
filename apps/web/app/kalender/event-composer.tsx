"use client";

import { useFormState } from "react-dom";
import type { ZielgruppenKatalog } from "@ah-intranet/shared";
import { Field, FormAlert, SubmitButton, inputClass } from "@/components/forms";
import { ZielgruppenAuswahl } from "@/components/zielgruppen-auswahl";
import { createEventAction, type ActionState } from "@/lib/actions";
import { toLocalInput } from "@/lib/utils";

const initialState: ActionState = { ok: true };

export function EventComposer({ katalog }: { katalog: ZielgruppenKatalog }) {
  const [state, formAction] = useFormState(createEventAction, initialState);

  const start = new Date();
  start.setHours(start.getHours() + 25, 0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2">
      <Field label="Titel *" wide>
        <input name="title" required minLength={3} className={inputClass} />
      </Field>

      <Field label="Kategorie *">
        <select name="category" required defaultValue="meeting" className={inputClass}>
          <option value="meeting">Meeting</option>
          <option value="schulung">Schulung</option>
          <option value="aktion">Aktion</option>
          <option value="wartung">Wartung</option>
          <option value="bestellung">Bestelltermin</option>
        </select>
      </Field>

      <Field label="Ort">
        <input name="location" className={inputClass} placeholder="Raum oder Standort" />
      </Field>

      <Field label="Beginn *">
        <input
          name="startsAt"
          type="datetime-local"
          required
          defaultValue={toLocalInput(start)}
          className={inputClass}
        />
      </Field>

      <Field label="Ende *">
        <input name="endsAt" type="datetime-local" required defaultValue={toLocalInput(end)} className={inputClass} />
      </Field>

      <Field label="Beschreibung" wide>
        <textarea name="description" rows={2} className={inputClass} />
      </Field>

      <Field label="Zielgruppe" wide hint="Von allen Häusern der Gruppe bis hinunter zur Abteilung">
        <div className="mt-2">
          <ZielgruppenAuswahl katalog={katalog} />
        </div>
      </Field>

      <div className="md:col-span-2">
        <FormAlert state={state} />
      </div>

      <div className="md:col-span-2">
        <SubmitButton>Termin anlegen</SubmitButton>
      </div>
    </form>
  );
}
