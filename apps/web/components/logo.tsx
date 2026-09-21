"use client";

import { useState } from "react";

/**
 * Ob das eigene Logo des Hauses geladen werden konnte.
 *
 * Ein Fehlschlag (kein Logo hinterlegt, Netzwerkfehler) fällt zurück auf das
 * AHOI-Zeichen - `useState` statt eines vorherigen Datenabrufs, weil ein
 * Bild, das nicht existiert, im Browser als `onError` ankommt, nicht als
 * Serverfehler, den eine Server Component vorher abfangen könnte.
 */
function useOwnLogo() {
  const [failed, setFailed] = useState(false);
  return { active: !failed, onError: () => setFailed(true) };
}

/**
 * Das AHOI-Zeichen selbst: ein Raster aus vier Feldern, drei belegt, eines
 * offen - die Module, die ein Haus einschaltet, und das eine, das es nicht
 * braucht.
 */
function AhoiZeichen({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <rect x="2" y="2" width="13" height="13" rx="3" fill="currentColor" />
      <rect x="17" y="2" width="13" height="13" rx="3" className="fill-brand-500" />
      <rect x="2" y="17" width="13" height="13" rx="3" fill="currentColor" />
      <rect x="17" y="17" width="13" height="13" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

/**
 * Nur das Zeichen, ohne Wortmarke - für die Anmeldeseiten, die "AHOI" separat
 * darüber setzen. Hat ein Haus ein eigenes Logo hinterlegt, ersetzt das hier
 * das AHOI-Zeichen vollständig (Weißmarke, siehe `/admin/erscheinungsbild`).
 */
export function Signet({ className = "h-7 w-7" }: { className?: string }) {
  const { active, onError } = useOwnLogo();
  if (active) {
    return <img src="/branding/logo" alt="" className={`${className} object-contain`} onError={onError} />;
  }
  return <AhoiZeichen className={className} />;
}

/**
 * Wort-Bild-Marke AHOI für die Kopfzeile. Mit eigenem Logo entfällt die
 * Wortmarke "AHOI" - neben dem eigenen Logo stünde sie nur im Weg.
 */
export function Logo({ className = "", signetClass = "h-7 w-7" }: { className?: string; signetClass?: string }) {
  const { active, onError } = useOwnLogo();
  if (active) {
    return <img src="/branding/logo" alt="" className={`${signetClass} object-contain ${className}`} onError={onError} />;
  }
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <AhoiZeichen className={signetClass} />
      <span className="font-display text-lg font-extrabold tracking-[0.08em]">AHOI</span>
    </span>
  );
}
