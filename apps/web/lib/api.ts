import { cookies } from "next/headers";

export const SESSION_COOKIE = "ah_session";

/** Serverseitige Basis-URL; im Container zeigt sie auf den API-Service. */
const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get isAuthError() {
    return this.status === 401;
  }

  /** 404 bedeutet in dieser API auch "Modul deaktiviert". */
  get isMissing() {
    return this.status === 404;
  }
}

function authHeader(): Record<string, string> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  return token ? { cookie: `${SESSION_COOKIE}=${token}` } : {};
}

async function parseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) {
      return body.message.join(", ");
    }
    return body.message ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

/**
 * Lesezugriff aus Server Components. Bewusst `no-store`: das Intranet zeigt
 * Freigaben, Tickets und Bestände - veraltete Daten wären hier schädlicher
 * als der eingesparte Roundtrip.
 */
export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...authHeader(), ...(init?.headers ?? {}) },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new ApiError(response.status, await parseError(response));
  }
  return (await response.json()) as T;
}

/** Wie `apiGet`, liefert aber `fallback` statt zu werfen (z. B. bei abgeschaltetem Modul). */
export async function apiGetSafe<T>(path: string, fallback: T): Promise<T> {
  try {
    return await apiGet<T>(path);
  } catch (error) {
    if (error instanceof ApiError && (error.isMissing || error.status === 403)) {
      return fallback;
    }
    throw error;
  }
}

export async function apiSend<T>(
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new ApiError(response.status, await parseError(response));
  }
  if (response.status === 204) {
    return undefined as T;
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export function apiBaseUrl() {
  return API_URL;
}
