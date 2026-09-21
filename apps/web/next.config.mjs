/**
 * Die API liefert JSON und schützt sich mit Helmet; die Content-Security-Policy
 * gehört dorthin, wo HTML entsteht - und das ist ausschließlich hier.
 *
 * `script-src` braucht `'unsafe-inline'`, solange Next seine Hydrierungsdaten
 * als Inline-Skript ausliefert. Statt einer Richtlinie, die bloß gut aussieht,
 * steht das hier als benannte Einschränkung: eine Nonce setzt voraus, dass jede
 * Seite dynamisch gerendert wird, und das ist für ein Intranet mit statischen
 * Anteilen zu teuer erkauft.
 */
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'",
  // Google Fonts: `layout.tsx` lädt Archivo und Source Sans 3 von dort. Das
  // Stylesheet kommt von fonts.googleapis.com, die Schriftdateien selbst von
  // fonts.gstatic.com - fehlt eines der beiden, fällt die Oberfläche auf
  // Systemschriften zurück. Wer die Schriften lieber selbst ausliefert,
  // streicht beide Einträge hier und in `docs/ci.md`.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob:",
  "font-src 'self' data: https://fonts.gstatic.com",
  // Server Components sprechen die API serverseitig an; aus dem Browser geht
  // nur der eigene Ursprung.
  "connect-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Doppelt zu `frame-ancestors`, aber ältere Browser kennen nur diesen Weg.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  // Ein Intranet braucht weder Kamera noch Mikrofon noch Standort.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
];

// HSTS nur in Produktion: auf http://localhost würde der Header den Browser
// für Monate auf HTTPS festnageln, auch für andere Dienste auf demselben Host.
if (process.env.NODE_ENV === "production") {
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  });
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Die Version im Antwortkopf sagt Angreifern, welche Lücken zu versuchen sind.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
