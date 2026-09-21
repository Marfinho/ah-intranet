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

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
