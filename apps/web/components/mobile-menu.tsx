"use client";

import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Menü für Telefone und kleine Tablets (unter `lg`).
 *
 * Auf dem Telefon darf die Navigation nicht als Karte vor dem Inhalt stehen:
 * 25 Einträge schöben jede Seite einen Bildschirm nach unten. Sie liegt hier
 * in einer Schublade. Schließen bei Seitenwechsel, Esc und Tipp daneben; solange
 * sie offen ist, scrollt der Hintergrund nicht mit.
 */
export function MobileMenu({ children, label = "Menü" }: { children: ReactNode; label?: string }) {
  const [offen, setOffen] = useState(false);
  const pathname = usePathname();
  const knopf = useRef<HTMLButtonElement>(null);
  const schliessen = useRef<HTMLButtonElement>(null);

  // Nach einem Seitenwechsel gehört der Bildschirm wieder dem Inhalt.
  useEffect(() => {
    setOffen(false);
  }, [pathname]);

  useEffect(() => {
    if (!offen) return;
    const vorher = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    schliessen.current?.focus();
    const taste = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOffen(false);
        knopf.current?.focus();
      }
    };
    window.addEventListener("keydown", taste);
    return () => {
      document.body.style.overflow = vorher;
      window.removeEventListener("keydown", taste);
    };
  }, [offen]);

  return (
    <>
      <button
        ref={knopf}
        type="button"
        onClick={() => setOffen(true)}
        aria-label={`${label} öffnen`}
        aria-expanded={offen}
        aria-controls="mobiles-menue"
        className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700"
      >
        <Menu className="h-5 w-5" />
      </button>

      {offen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={label}>
          <button
            type="button"
            aria-label={`${label} schließen`}
            tabIndex={-1}
            onClick={() => setOffen(false)}
            className="absolute inset-0 bg-slate-900/50"
          />
          <div
            id="mobiles-menue"
            className="absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col bg-white shadow-xl"
            style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
              <span className="text-sm font-semibold text-slate-500">{label}</span>
              <button
                ref={schliessen}
                type="button"
                onClick={() => setOffen(false)}
                aria-label={`${label} schließen`}
                className="flex h-11 w-11 items-center justify-center rounded-full text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-3">{children}</div>
          </div>
        </div>
      ) : null}
    </>
  );
}
