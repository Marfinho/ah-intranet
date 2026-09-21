import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "ah_session";
const PUBLIC_PATHS = ["/login", "/start"];

/**
 * Basis-Domain des Betreibers (z. B. `ahoi.online`), ohne Subdomain eines
 * Hauses. Nur auf genau dieser Adresse zeigt `/` die öffentliche
 * Produktseite statt eines Anmeldeformulars ohne erkennbaren Mandanten -
 * siehe `docs/plattform.md`. Fehlt die Variable, verhält sich alles wie
 * bisher (Einzelinstallation ohne eigene Marketingseite).
 */
const BASIS_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN;

function istBasisDomain(host: string | null): boolean {
  if (!BASIS_DOMAIN || !host) {
    return false;
  }
  const hostname = host.split(":")[0].toLowerCase();
  return hostname === BASIS_DOMAIN || hostname === `www.${BASIS_DOMAIN}`;
}

/**
 * Grobfilter vor dem Rendern: ohne Sitzungscookie geht es direkt zum Login.
 * Die inhaltliche Prüfung macht weiterhin die API - das hier spart nur
 * unnötige Renderdurchläufe.
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  // Wurzelseite auf der Adresse des Betreibers, ohne Sitzung: das ist kein
  // Haus, das sich anmelden will, sondern jemand, der die Marketingseite
  // sucht. Jede Subdomain und jede eigene Kundendomain bleibt unverändert.
  if (pathname === "/" && !hasSession && istBasisDomain(request.headers.get("host"))) {
    return NextResponse.rewrite(new URL("/start", request.url));
  }

  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  if (!hasSession && !isPublic) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", `${pathname}${search}`);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (hasSession && isPublic && pathname !== "/start") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
