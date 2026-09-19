/**
 * Wort-Bild-Marke AHOI.
 *
 * Das Signet ist ein Raster aus vier Feldern: drei belegt, eines offen – die
 * Module, die ein Haus einschaltet, und das eine, das es nicht braucht. Das
 * Zeichen erzählt damit dasselbe wie die Software.
 *
 * Die Wortmarke steht bewusst als Text und nicht als Pfad im SVG: so greift die
 * Hausschrift, und der Name bleibt kopier- und vorlesbar.
 */
export function Signet({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <rect x="2" y="2" width="13" height="13" rx="3" fill="currentColor" />
      <rect x="17" y="2" width="13" height="13" rx="3" className="fill-brand-500" />
      <rect x="2" y="17" width="13" height="13" rx="3" fill="currentColor" />
      <rect x="17" y="17" width="13" height="13" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function Logo({ className = "", signetClass = "h-7 w-7" }: { className?: string; signetClass?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Signet className={signetClass} />
      <span className="font-display text-lg font-extrabold tracking-[0.08em]">AHOI</span>
    </span>
  );
}
