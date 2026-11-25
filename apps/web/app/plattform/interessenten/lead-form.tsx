"use client";

import { useFormState } from "react-dom";
import { Field, FormAlert, SubmitButton, inputClass } from "@/components/forms";
import type { ActionState } from "@/lib/actions";

const start: ActionState = { ok: true };

const HILFE =
  "Eine Zeile je Haus. Der Name genügt – die Pitch-Seite entsteht daraus sofort, der Interessent ergänzt den Rest selbst. " +
  "Mehr geht so: Name | Straße | PLZ Ort | Marken | Leistungen | Öffnungszeiten | Verbund | eigener Text. " +
  "Marken und Leistungen mit Komma trennen. Häuser mit gleichem Verbund (z. B. dieselbe Straße) nutzen " +
  "Raumbuchung und Kalender gemeinsam.";

/** Anlage und Änderung eines Interessenten: dasselbe Formular, nur eine andere Aktion. */
export function LeadForm({
  action,
  vorgabe,
  neu,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  vorgabe?: { name: string; ansprechperson: string; notiz: string; standorte: string };
  neu?: boolean;
}) {
  const [state, formAction] = useFormState(action, start);

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2">
      <Field label="Unternehmen oder Gruppe *">
        <input
          name="name"
          required
          defaultValue={vorgabe?.name}
          className={inputClass}
          placeholder="HACKEROTT Autohaus Gruppe"
        />
      </Field>
      <Field label="Häuser *" hint={HILFE} wide>
        <textarea
          name="standorte"
          required
          rows={9}
          defaultValue={vorgabe?.standorte}
          className={`${inputClass} font-mono text-xs`}
          placeholder={
            "Autopark Burgwedel | Kokenhorststraße 6 | 30938 Burgwedel | SEAT, CUPRA | Verkauf, Service | Mo–Fr 9–18, Sa 9–14 | Kokenhorststraße"
          }
        />
      </Field>

      <details className="md:col-span-2 rounded-lg border border-slate-200 p-3" open={!neu}>
        <summary className="cursor-pointer text-sm font-medium">Weitere Angaben (alles freiwillig)</summary>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <Field label="Ansprechperson" hint="Sieht der Interessent nicht.">
            <input name="ansprechperson" defaultValue={vorgabe?.ansprechperson} className={inputClass} />
          </Field>

          <Field label="Notiz" hint="Interne Notiz, sieht der Interessent nicht." wide>
            <input name="notiz" defaultValue={vorgabe?.notiz} className={inputClass} />
          </Field>

          {neu ? (
            <>
              <Field label="Startwert Nutzer" hint="Der Interessent stellt seine Zahl selbst ein. Leer: 25 je Haus.">
                <input name="nutzer" type="number" min={1} className={inputClass} />
              </Field>
              <Field label="Link gültig (Tage)" hint="Leer: 60 Tage, höchstens 365.">
                <input name="linkTage" type="number" min={1} max={365} className={inputClass} />
              </Field>
            </>
          ) : null}
        </div>
      </details>

      <div className="md:col-span-2 space-y-3">
        <FormAlert state={state} />
        <SubmitButton>{neu ? "Interessent anlegen und Link erzeugen" : "Speichern"}</SubmitButton>
      </div>
    </form>
  );
}
