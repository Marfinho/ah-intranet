"use client";

import { useEffect, useRef } from "react";
import { markNewsReadAction } from "@/lib/actions";

/**
 * Markiert einen Beitrag beim Öffnen als gelesen. Läuft genau einmal pro
 * Mount und nur, wenn er noch nicht gelesen war.
 */
export function MarkReadOnView({ slug, alreadyRead }: { slug: string; alreadyRead: boolean }) {
  const sent = useRef(false);

  useEffect(() => {
    if (alreadyRead || sent.current) {
      return;
    }
    sent.current = true;
    void markNewsReadAction(slug);
  }, [slug, alreadyRead]);

  return null;
}
