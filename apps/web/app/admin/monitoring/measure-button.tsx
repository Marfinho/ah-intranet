"use client";

import { ActionButton } from "@/components/forms";
import { measureNowAction } from "@/lib/actions";

/** Löst sofort eine Messung aus - etwa um das Warnsystem zu testen. */
export function MeasureButton() {
  return (
    <ActionButton action={measureNowAction} variant="ghost">
      Jetzt messen
    </ActionButton>
  );
}
