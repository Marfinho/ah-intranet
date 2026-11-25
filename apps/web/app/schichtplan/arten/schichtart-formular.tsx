"use client";

import { useFormState } from "react-dom";
import { WOCHENTAGE, type SchichtartItem } from "@ah-intranet/shared";
import { Field, FormAlert, SubmitButton, inputClass } from "@/components/forms";
import { createSchichtartAction, updateSchichtartAction, type ActionState } from "@/lib/actions";

const initialState: ActionState = { ok: true };

export interface Auswahl {
  id: string;
  name: string;
}

/**
 * Eine Schichtart anlegen oder ändern.
 *
 * Mindest- und Idealbesetzung sind Pflicht: ohne Soll lässt sich nicht planen und
 * nicht erkennen, wann eine Schicht unterbesetzt ist. Der Bereich ist frei
 * kombinierbar - Standort, Abteilung, Team; leer heißt: für das ganze Haus.
 */
export function SchichtartFormular({
  art,
  standorte,
  abteilungen,
  teams,
}: {
  art?: SchichtartItem;
  standorte: Auswahl[];
  abteilungen: Auswahl[];
  /** Führungskräfte; ihr Team sind die direkt Unterstellten. */
  teams: Auswahl[];
}) {
  const aktion = art ? updateSchichtartAction.bind(null, art.id) : createSchichtartAction;
  const [state, formAction] = useFormState(aktion, initialState);
  const tage = art?.tage ?? [1, 2, 3, 4, 5];

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-3">
      <Field label="Name *" hint="z. B. Frühschicht">
        <input name="name" required minLength={2} maxLength={60} defaultValue={art?.name} className={inputClass} />
      </Field>

      <Field label="Beginn *">
        <input name="startZeit" type="time" required defaultValue={art?.startZeit ?? "08:00"} className={inputClass} />
      </Field>

      <Field label="Ende *" hint="Früher als der Beginn heißt: über Mitternacht">
        <input name="endZeit" type="time" required defaultValue={art?.endZeit ?? "15:00"} className={inputClass} />
      </Field>

      <Field label="Mindestbesetzung *" hint="Darunter ist die Schicht unterbesetzt">
        <input
          name="mindestBesetzung"
          type="number"
          required
          min={1}
          max={99}
          defaultValue={art?.mindestBesetzung ?? 1}
          className={inputClass}
        />
      </Field>

      <Field label="Idealbesetzung *" hint="Zielwert der Planung">
        <input
          name="idealBesetzung"
          type="number"
          required
          min={1}
          max={99}
          defaultValue={art?.idealBesetzung ?? 2}
          className={inputClass}
        />
      </Field>

      <Field label="Pause (Minuten)" hint="Unbezahlt; ab 6 Stunden verlangt das Gesetz 30 Minuten">
        <input
          name="pauseMinuten"
          type="number"
          min={0}
          max={240}
          defaultValue={art?.pauseMinuten ?? 30}
          className={inputClass}
        />
      </Field>

      <fieldset className="md:col-span-3">
        <legend className="text-sm font-medium text-slate-700">Wochentage *</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {WOCHENTAGE.map((tag) => (
            <label
              key={tag.nummer}
              className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                name="tage"
                value={tag.nummer}
                defaultChecked={tage.includes(tag.nummer)}
                className="h-4 w-4"
              />
              {tag.kurz}
            </label>
          ))}
        </div>
      </fieldset>

      <Field label="Standort" hint="Leer = alle Standorte">
        <select name="locationId" defaultValue={art?.locationId ?? ""} className={inputClass}>
          <option value="">– alle –</option>
          {standorte.map((eintrag) => (
            <option key={eintrag.id} value={eintrag.id}>
              {eintrag.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Abteilung" hint="Leer = alle Abteilungen">
        <select name="departmentId" defaultValue={art?.departmentId ?? ""} className={inputClass}>
          <option value="">– alle –</option>
          {abteilungen.map((eintrag) => (
            <option key={eintrag.id} value={eintrag.id}>
              {eintrag.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Team" hint="Die direkt Unterstellten dieser Führungskraft">
        <select name="teamLeadId" defaultValue={art?.teamLeadId ?? ""} className={inputClass}>
          <option value="">– alle –</option>
          {teams.map((eintrag) => (
            <option key={eintrag.id} value={eintrag.id}>
              Team {eintrag.name}
            </option>
          ))}
        </select>
      </Field>

      <label className="flex items-start gap-3 text-sm md:col-span-2">
        <input type="checkbox" name="beiSondertag" defaultChecked={art?.beiSondertag} className="mt-1 h-4 w-4" />
        <span>
          <span className="font-medium text-slate-800">Auch an Sondertagen</span>
          <span className="block text-xs text-slate-500">
            Plant die Schicht auch an Tagen, die laut Betriebskalender ausdrücklich Arbeitstage sind, etwa an einem
            verkaufsoffenen Sonntag - egal, welche Wochentage oben stehen.
          </span>
        </span>
      </label>

      {art ? (
        <label className="flex items-center gap-3 text-sm">
          <input type="hidden" name="aktivGesendet" value="1" />
          <input type="checkbox" name="aktiv" defaultChecked={art.aktiv} className="h-4 w-4" />
          Aktiv (in die Planung einbeziehen)
        </label>
      ) : null}

      <div className="md:col-span-3">
        <FormAlert state={state} />
      </div>
      <div className="md:col-span-3">
        <SubmitButton>{art ? "Speichern" : "Schichtart anlegen"}</SubmitButton>
      </div>
    </form>
  );
}
