"use client";

import { useEffect, useState } from "react";
import type { EinrichtungStatusPayload } from "@ah-intranet/shared";
import { pflichtschritteErledigt } from "@ah-intranet/shared";
import { Section } from "@/components/ui";
import { EinrichtungsChecklistItem } from "@/components/einrichtungs-checklist-item";
import { EinrichtungsFortschritt } from "@/components/einrichtungs-fortschritt";

const AUSGEBLENDET_KEY = "ahoi:einrichtung:ausgeblendet";

/**
 * Dauerhaft erreichbare Checkliste im Dashboard.
 *
 * Nach vollständigem Abschluss lässt sie sich ausblenden - das ist eine reine
 * Bequemlichkeit im Browser (`localStorage`), keine Quelle der Wahrheit: der
 * tatsächliche Abschluss steht im Backend, und über "Profil" lässt sich die
 * Einrichtung jederzeit erneut starten.
 */
export function EinrichtungsChecklist({
  status,
  erlaubeAusblenden = true,
}: {
  status: EinrichtungStatusPayload | null;
  /** false auf der eigenen Einrichtungsseite: dort wurde sie gerade bewusst aufgerufen. */
  erlaubeAusblenden?: boolean;
}) {
  const [ausgeblendet, setAusgeblendet] = useState(false);

  useEffect(() => {
    if (!erlaubeAusblenden) {
      return;
    }
    try {
      setAusgeblendet(window.localStorage.getItem(AUSGEBLENDET_KEY) === "1");
    } catch {
      // Privater Modus oder blockierter Speicher - dann bleibt die Karte sichtbar.
    }
  }, [erlaubeAusblenden]);

  if (!status || status.schritte.length === 0) {
    return null;
  }

  if (erlaubeAusblenden && status.abgeschlossen && ausgeblendet) {
    return null;
  }

  const pflichtErledigt = pflichtschritteErledigt(status.schritte);

  return (
    <Section
      title="Ersteinrichtung"
      subtitle={
        status.abgeschlossen
          ? "Grundsetup abgeschlossen - unter „Mein Profil“ jederzeit erneut startbar."
          : "In wenigen Schritten zum Grundsetup - jeder Punkt ist überspringbar und später fortsetzbar."
      }
    >
      <div className="space-y-4">
        <EinrichtungsFortschritt schritte={status.schritte} />

        {pflichtErledigt ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Alle Pflichtschritte sind erledigt. Optionale Punkte können Sie jederzeit noch abschließen.
          </div>
        ) : null}

        <ul className="space-y-3">
          {status.schritte.map((schritt) => (
            <EinrichtungsChecklistItem key={schritt.id} schritt={schritt} />
          ))}
        </ul>

        {status.abgeschlossen && erlaubeAusblenden ? (
          <button
            type="button"
            onClick={() => {
              try {
                window.localStorage.setItem(AUSGEBLENDET_KEY, "1");
              } catch {
                // Ohne Speicher bleibt die Karte einfach sichtbar.
              }
              setAusgeblendet(true);
            }}
            className="text-sm font-semibold text-brand-700 hover:underline"
          >
            Checkliste ausblenden
          </button>
        ) : null}
      </div>
    </Section>
  );
}
