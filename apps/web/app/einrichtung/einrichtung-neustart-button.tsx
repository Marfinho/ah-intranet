"use client";

import { ActionButton } from "@/components/forms";
import { restartEinrichtungAction } from "@/lib/actions";

/** Startet die eigene Ersteinrichtung neu - jede angemeldete Person darf das für sich selbst. */
export function EinrichtungNeustartButton() {
  return (
    <ActionButton
      action={restartEinrichtungAction}
      variant="ghost"
      confirm="Die Einrichtung wird auf den Anfang zurückgesetzt. Fortfahren?"
    >
      Einrichtung erneut starten
    </ActionButton>
  );
}
