import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "ah_session";
/** Erreichbar ohne Anmeldung. */
const OHNE_ANMELDUNG = ["/login", "/passwort-vergessen", "/passwort-neu"];

/**
 * Wegführen, wenn schon angemeldet.
 *
 * Nur das Anmeldeformular. Die Passwortseiten bleiben erreichbar: wer in einem
 * zweiten Tab noch angemeldet ist und trotzdem sein Passwort zurücksetzen
 * möchte, soll nicht auf die Startseite geworfen werden.
 */
const NUR_ABGEMELDET = ["/login"];

/**
 * Grobfilter vor dem Rendern: ohne Sitzungscookie geht es direkt zum Login.
 * Die inhaltliche Prüfung macht weiterhin die API - das hier spart nur
 * unnötige Renderdurchläufe.
 */
export function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce);

  // Next liest Einmalkennung und Richtlinie aus den Anfrage-Kopfzeilen und
  // versieht damit die eigenen Skripte.
  const anfrageKoepfe = new Headers(request.headers);
  anfrageKoepfe.set("x-nonce", nonce);
  anfrageKoepfe.set("content-security-policy", csp);

  return mitRichtlinie(leiteWeiter(request, anfrageKoepfe), csp);
}

/**
 * Die Richtlinie lässt nur eigene Quellen zu. `strict-dynamic` vertraut den
 * Skripten, die ein mit Einmalkennung versehenes Skript nachlädt - ohne das
 * müsste jeder Chunk von Next einzeln aufgeführt werden. Inline-Styles bleiben
 * erlaubt: React setzt sie für Breiten (Fortschrittsbalken) und Tailwind
 * erzeugt keine Nonces; Skripte sind das Einfallstor, nicht Styles.
 */
function contentSecurityPolicy(nonce: string): string {
  const entwicklung = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${entwicklung ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

function mitRichtlinie(response: NextResponse, csp: string): NextResponse {
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

function leiteWeiter(request: NextRequest, anfrageKoepfe: Headers): NextResponse {
  const { pathname, search } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const oeffentlich = OHNE_ANMELDUNG.some((path) => pathname.startsWith(path));

  if (!hasSession && !oeffentlich) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", `${pathname}${search}`);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (hasSession && NUR_ABGEMELDET.some((path) => pathname.startsWith(path))) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next({ request: { headers: anfrageKoepfe } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
