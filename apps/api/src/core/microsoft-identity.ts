import { BadRequestException, UnauthorizedException } from "@nestjs/common";

/**
 * Roher Austausch mit der Microsoft-Identitätsplattform (Entra ID) und Graph.
 *
 * Bewusst ohne Abhängigkeit von einer OAuth-Bibliothek: der Austausch besteht
 * aus zwei einfachen HTTP-Aufrufen, und Node bringt `fetch` seit Version 18
 * mit. Eine zusätzliche Bibliothek dafür wäre Vorbauen auf Verdacht.
 *
 * **Zur Vertrauensfrage beim ID-Token:** Die Signatur wird hier nicht gegen
 * die JWKS-Schlüssel von Microsoft geprüft, nur `aud`, `iss` und `exp`. Das ist
 * vertretbar, weil dieses ID-Token nicht vom Browser durchgereicht wird
 * (Implicit-Flow-Risiko), sondern die API es selbst - mit Clientschlüssel
 * authentifiziert, über TLS - direkt vom Token-Endpunkt abholt. Fälschen
 * könnte es nur, wer bereits den Clientschlüssel hat; dann wäre die
 * Signaturprüfung ohnehin nicht die erste Verteidigungslinie.
 */

const SCOPE = "openid profile email offline_access User.Read Calendars.Read";

export interface MicrosoftTokens {
  accessToken: string;
  /** Fehlt, wenn `offline_access` vom Anbieter nicht gewährt wurde. */
  refreshToken: string | null;
  idToken: string;
  expiresInSeconds: number;
}

export interface EntraIdClaims {
  /** Objekt-ID - eindeutig und unveränderlich, anders als die E-Mail-Adresse. */
  oid: string;
  email: string | null;
  name: string | null;
}

function tokenEndpoint(directory: string): string {
  return `https://login.microsoftonline.com/${encodeURIComponent(directory)}/oauth2/v2.0/token`;
}

export function buildAuthorizeUrl(input: {
  directory: string;
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL(`https://login.microsoftonline.com/${encodeURIComponent(input.directory)}/oauth2/v2.0/authorize`);
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("state", input.state);
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

async function requestTokens(directory: string, body: URLSearchParams): Promise<MicrosoftTokens> {
  let response: Response;
  try {
    response = await fetch(tokenEndpoint(directory), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  } catch {
    throw new BadRequestException("Microsoft ist gerade nicht erreichbar. Bitte später erneut versuchen.");
  }

  const payload = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    id_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !payload.access_token || !payload.id_token) {
    throw new UnauthorizedException(
      payload.error_description?.split(/\r?\n/)[0] ?? "Die Anmeldung mit Microsoft ist fehlgeschlagen.",
    );
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? null,
    idToken: payload.id_token,
    expiresInSeconds: payload.expires_in ?? 3600,
  };
}

export function exchangeCodeForTokens(input: {
  directory: string;
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}): Promise<MicrosoftTokens> {
  const body = new URLSearchParams({
    client_id: input.clientId,
    client_secret: input.clientSecret,
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirectUri,
    scope: SCOPE,
  });
  return requestTokens(input.directory, body);
}

export function refreshAccessToken(input: {
  directory: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<MicrosoftTokens> {
  const body = new URLSearchParams({
    client_id: input.clientId,
    client_secret: input.clientSecret,
    grant_type: "refresh_token",
    refresh_token: input.refreshToken,
    scope: SCOPE,
  });
  return requestTokens(input.directory, body);
}

/** Siehe Erläuterung zur Vertrauensfrage oben im Dateikopf. */
export function decodeIdTokenClaims(idToken: string, expectedClientId: string, directory: string): EntraIdClaims {
  const teile = idToken.split(".");
  if (teile.length !== 3) {
    throw new UnauthorizedException("Das ID-Token von Microsoft hat kein gültiges Format.");
  }

  let payload: {
    oid?: string;
    sub?: string;
    preferred_username?: string;
    email?: string;
    name?: string;
    aud?: string;
    iss?: string;
    exp?: number;
    tid?: string;
  };
  try {
    payload = JSON.parse(Buffer.from(teile[1], "base64url").toString("utf8"));
  } catch {
    throw new UnauthorizedException("Das ID-Token von Microsoft ließ sich nicht lesen.");
  }

  if (payload.aud !== expectedClientId) {
    throw new UnauthorizedException("Das ID-Token gehört zu einer anderen App-Registrierung.");
  }
  if (!payload.exp || payload.exp * 1000 < Date.now()) {
    throw new UnauthorizedException("Das ID-Token von Microsoft ist bereits abgelaufen.");
  }
  // "common"/"organizations" wird bei der Anmeldung nicht verwendet - jedes Haus
  // hat sein eigenes Verzeichnis, `tid` muss also genau dazu passen.
  if (payload.tid !== directory) {
    throw new UnauthorizedException("Das ID-Token gehört zu einem anderen Verzeichnis.");
  }
  if (!payload.oid) {
    throw new UnauthorizedException("Das ID-Token von Microsoft nennt keine Objekt-ID.");
  }

  return {
    oid: payload.oid,
    email: (payload.email ?? payload.preferred_username ?? null)?.toLowerCase() ?? null,
    name: payload.name ?? null,
  };
}
