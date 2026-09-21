import { NextResponse, type NextRequest } from "next/server";
import { sitzungsCookieName } from "@ah-intranet/shared";

/** Derselbe Name, den API und Server Components verwenden. */
const SESSION_COOKIE = sitzungsCookieName(process.env.NODE_ENV === "production");
const PUBLIC_PATHS = ["/login"];

/**
 * Grobfilter vor dem Rendern: ohne Sitzungscookie geht es direkt zum Login.
 * Die inhaltliche Prüfung macht weiterhin die API - das hier spart nur
 * unnötige Renderdurchläufe.
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  if (!hasSession && !isPublic) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", `${pathname}${search}`);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (hasSession && isPublic) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
