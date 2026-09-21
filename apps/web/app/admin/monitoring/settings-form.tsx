"use client";

import { useFormState } from "react-dom";
import type { PlatformMonitoringSettings } from "@ah-intranet/shared";
import { Field, FormAlert, SubmitButton, inputClass } from "@/components/forms";
import { setMonitoringSettingsAction, type ActionState } from "@/lib/actions";

const initialState: ActionState = { ok: true };

/** Empfängeradresse und Schwellen des Warnsystems. */
export function MonitoringSettingsForm({ settings }: { settings: PlatformMonitoringSettings }) {
  const [state, formAction] = useFormState(setMonitoringSettingsAction, initialState);

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2">
      <Field label="Empfänger der Warnung" wide hint="Leer lassen schaltet das Warnsystem ab">
        <input
          name="alertEmail"
          type="email"
          defaultValue={settings.alertEmail ?? ""}
          className={inputClass}
          placeholder="betrieb@ihre-firma.de"
        />
      </Field>
      <Field label="Schwelle CPU (%)">
        <input
          name="cpuThresholdPercent"
          type="number"
          min={1}
          max={100}
          defaultValue={settings.cpuThresholdPercent}
          className={inputClass}
        />
      </Field>
      <Field label="Schwelle Arbeitsspeicher (%)">
        <input
          name="memThresholdPercent"
          type="number"
          min={1}
          max={100}
          defaultValue={settings.memThresholdPercent}
          className={inputClass}
        />
      </Field>
      <Field label="Schwelle Plattenplatz (%)">
        <input
          name="diskThresholdPercent"
          type="number"
          min={1}
          max={100}
          defaultValue={settings.diskThresholdPercent}
          className={inputClass}
        />
      </Field>
      <Field label="Abstand zwischen Warnungen (Minuten)">
        <input
          name="cooldownMinutes"
          type="number"
          min={5}
          defaultValue={settings.cooldownMinutes}
          className={inputClass}
        />
      </Field>
      <div className="md:col-span-2">
        <FormAlert state={state} />
        <div className="pt-2">
          <SubmitButton>Warnsystem speichern</SubmitButton>
        </div>
      </div>
    </form>
  );
}
