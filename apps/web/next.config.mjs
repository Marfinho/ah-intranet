/** Kopfzeilen, die für jede Antwort gelten. Die Content-Security-Policy steht
 *  in `middleware.ts`, weil sie je Anfrage eine neue Einmalkennung braucht. */
const sicherheitskoepfe = [
  // Wirkt nur über HTTPS; über HTTP (Erprobung) ignoriert der Browser sie.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Zusätzlich zu `frame-ancestors` für ältere Browser.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Verrät nur, dass Next läuft - erleichtert gezielte Angriffe, nützt sonst niemandem.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: sicherheitskoepfe }];
  },
};

export default nextConfig;
