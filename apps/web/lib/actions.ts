"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ApiError, SESSION_COOKIE, apiBaseUrl, apiSend } from "./api";

export interface ActionState {
  ok: boolean;
  message?: string;
  /** Freitext für Erfolgsmeldungen, z. B. generierte Passwörter. */
  detail?: string;
}

/**
 * Einheitliche Fehlerbehandlung: API-Fehlermeldungen werden durchgereicht.
 *
 * Diese Datei ist ein "use server"-Modul und darf deshalb ausschließlich
 * async-Funktionen exportieren - Konstanten oder Objekte brechen den Build.
 */
async function run(operation: () => Promise<unknown>, paths: string[], detail?: string): Promise<ActionState> {
  try {
    await operation();
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, message: error.message };
    }
    return { ok: false, message: "Unerwarteter Fehler. Bitte erneut versuchen." };
  }
  for (const path of paths) {
    revalidatePath(path);
  }
  return { ok: true, detail };
}

/* -------------------------------------------------------------- Auth */

/**
 * Fordert einen Zurücksetz-Link an.
 *
 * Die Antwort ist immer dieselbe - auch bei unbekannter Kennung. Das Formular
 * soll kein Verzeichnis gültiger Benutzernamen werden.
 */
export async function passwortVergessenAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const username = String(formData.get("username") ?? "").trim();
  const tenant = String(formData.get("tenant") ?? "")
    .trim()
    .toLowerCase();

  if (!username) {
    return { ok: false, message: "Bitte Benutzername eingeben." };
  }

  try {
    await fetch(`${apiBaseUrl()}/auth/passwort-vergessen`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, ...(tenant ? { tenant } : {}) }),
      cache: "no-store",
    });
  } catch {
    return { ok: false, message: "Das Intranet ist gerade nicht erreichbar. Bitte später erneut versuchen." };
  }

  return {
    ok: true,
    detail:
      "Wenn es zu dieser Kennung ein Konto mit hinterlegter E-Mail-Adresse gibt, ist eine Nachricht unterwegs. " +
      "Der Link gilt eine Stunde.",
  };
}

export async function passwortNeuAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const wiederholung = String(formData.get("passwordRepeat") ?? "");

  if (password !== wiederholung) {
    return { ok: false, message: "Die beiden Passwörter stimmen nicht überein." };
  }
  if (password.length < 10) {
    return { ok: false, message: "Das neue Passwort muss mindestens 10 Zeichen lang sein." };
  }

  const response = await fetch(`${apiBaseUrl()}/auth/passwort-neu`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string | string[] };
    const meldung = Array.isArray(body.message) ? body.message[0] : body.message;
    return { ok: false, message: meldung ?? "Das Passwort konnte nicht gesetzt werden." };
  }

  return { ok: true, detail: "Das Passwort ist gesetzt. Bitte melden Sie sich neu an." };
}

export async function loginAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");
  // Nur nötig, wenn mehrere Häuser auf derselben Adresse laufen. Steht das Haus
  // über eine eigene Domain fest, bleibt das Feld leer.
  const tenant = String(formData.get("tenant") ?? "")
    .trim()
    .toLowerCase();

  if (!username || !password) {
    return { ok: false, message: "Bitte Benutzername und Passwort eingeben." };
  }

  const response = await fetch(`${apiBaseUrl()}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, ...(tenant ? { tenant } : {}) }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    return { ok: false, message: body.message ?? "Anmeldung fehlgeschlagen." };
  }

  // Das Set-Cookie der API in die Next-Antwort übernehmen, damit Server
  // Components im selben Origin authentifiziert sind.
  const setCookie = response.headers.get("set-cookie") ?? "";
  const token = /ah_session=([^;]+)/.exec(setCookie)?.[1];
  if (!token) {
    return { ok: false, message: "Die Sitzung konnte nicht gesetzt werden." };
  }

  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 12 * 60 * 60,
    path: "/",
  });

  redirect(next.startsWith("/") ? next : "/");
}

export async function logoutAction(): Promise<void> {
  try {
    await apiSend("POST", "/auth/logout");
  } catch {
    // Auch bei API-Fehler lokal abmelden.
  }
  cookies().delete(SESSION_COOKIE);
  redirect("/login");
}

export async function changePasswordAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const repeat = String(formData.get("repeatPassword") ?? "");

  if (newPassword !== repeat) {
    return { ok: false, message: "Die beiden neuen Passwörter stimmen nicht überein." };
  }

  return run(
    () => apiSend("POST", "/auth/password", { currentPassword, newPassword }),
    ["/profil"],
    "Passwort geändert.",
  );
}

/* ------------------------------------------------------------ Module */

export async function setModuleEnabledAction(key: string, enabled: boolean): Promise<ActionState> {
  return run(() => apiSend("PUT", `/modules/${key}`, { enabled }), ["/", "/admin", "/admin/module"]);
}

export async function resetModulesAction(): Promise<ActionState> {
  return run(() => apiSend("POST", "/modules/reset"), ["/", "/admin", "/admin/module"]);
}

/* ------------------------------------------------------- Datenschutz */

export async function aufbewahrungAusfuehrenAction(): Promise<ActionState> {
  return run(() => apiSend("POST", "/datenschutz/aufbewahrung/ausfuehren"), ["/admin/datenschutz"]);
}

/**
 * Anonymisierung nach Art. 17 DSGVO. Unumkehrbar, deshalb verlangt die API eine
 * ausdrückliche Bestätigung - die Oberfläche fragt zusätzlich nach.
 */
export async function personLoeschenAction(userId: string, anlass: string): Promise<ActionState> {
  return run(
    () => apiSend("DELETE", `/datenschutz/person/${userId}`, { bestaetigt: true, anlass }),
    ["/admin/datenschutz", "/admin/benutzer", "/mitarbeiter"],
    "Die Person wurde anonymisiert. Freitexte müssen von Hand durchgesehen werden.",
  );
}

/* --------------------------------------------------------- Mandanten */

export async function createTenantAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const payload = {
    slug: String(formData.get("slug") ?? ""),
    name: String(formData.get("name") ?? ""),
    domain: String(formData.get("domain") ?? "") || undefined,
    notes: String(formData.get("notes") ?? "") || undefined,
    adminUsername: String(formData.get("adminUsername") ?? ""),
    adminPassword: String(formData.get("adminPassword") ?? ""),
    adminFirstName: String(formData.get("adminFirstName") ?? "") || undefined,
    adminLastName: String(formData.get("adminLastName") ?? "") || undefined,
    adminEmail: String(formData.get("adminEmail") ?? "") || undefined,
  };

  return run(() => apiSend("POST", "/tenants", payload), ["/admin/mandanten"], `Haus "${payload.name}" eingerichtet.`);
}

export async function setTenantActiveAction(id: string, isActive: boolean): Promise<ActionState> {
  return run(() => apiSend("PATCH", `/tenants/${id}/aktiv`, { isActive }), ["/admin/mandanten"]);
}

/** `logoUrl: null` nimmt ein hinterlegtes Logo zurück. */
export async function setTenantLogoAction(id: string, logoUrl: string | null): Promise<ActionState> {
  return run(() => apiSend("PATCH", `/tenants/${id}/logo`, { logoUrl }), ["/admin/mandanten"]);
}

/* -------------------------------------------------------------- News */

export async function createNewsAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const payload = {
    title: String(formData.get("title") ?? ""),
    teaser: String(formData.get("teaser") ?? ""),
    content: String(formData.get("content") ?? ""),
    priority: String(formData.get("priority") ?? "normal"),
    status: String(formData.get("status") ?? "draft"),
    pinned: formData.get("pinned") === "on",
    audienceScopes: formData.getAll("audienceScopes").map(String).filter(Boolean),
    expiresAt: String(formData.get("expiresAt") ?? "") || null,
  };

  if (payload.audienceScopes.length === 0) {
    payload.audienceScopes = ["global"];
  }

  return run(() => apiSend("POST", "/news", payload), ["/aktuelles", "/admin/news", "/"], "Beitrag gespeichert.");
}

export async function setNewsStatusAction(id: string, status: string): Promise<ActionState> {
  return run(() => apiSend("PATCH", `/news/${id}`, { status }), ["/aktuelles", "/admin/news", "/"]);
}

export async function deleteNewsAction(id: string): Promise<ActionState> {
  return run(() => apiSend("DELETE", `/news/${id}`), ["/aktuelles", "/admin/news", "/"]);
}

export async function markNewsReadAction(slug: string): Promise<ActionState> {
  return run(() => apiSend("POST", `/news/${slug}/read`), [`/aktuelles/${slug}`, "/aktuelles", "/"]);
}

export async function commentNewsAction(
  slug: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const message = String(formData.get("message") ?? "").trim();
  if (message.length < 2) {
    return { ok: false, message: "Bitte einen Kommentar eingeben." };
  }
  return run(() => apiSend("POST", `/news/${slug}/comments`, { message }), [`/aktuelles/${slug}`]);
}

/* ------------------------------------------------------- Bestellungen */

export async function createBusinessCardOrderAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const quantity = Number(formData.get("quantity") ?? 0);
  const values: Record<string, string> = {};

  for (const [key, value] of formData.entries()) {
    if (key.startsWith("field:")) {
      values[key.slice(6)] = String(value);
    }
  }

  return run(
    () => apiSend("POST", "/orders/business-cards", { quantity, values }),
    ["/bestellungen/meine", "/bestellungen/visitenkarten", "/freigaben", "/"],
    "Bestellung eingereicht.",
  );
}

export async function createWorkwearOrderAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const items: { catalogItemId: string; size: string; quantity: number }[] = [];

  for (const [key, value] of formData.entries()) {
    // Feldname: "item:<catalogItemId>:<size>"
    if (!key.startsWith("item:")) continue;
    const quantity = Number(value);
    if (!quantity) continue;
    const [, catalogItemId, size] = key.split(":");
    items.push({ catalogItemId, size, quantity });
  }

  if (items.length === 0) {
    return { ok: false, message: "Bitte mindestens einen Artikel mit Menge wählen." };
  }

  return run(
    () => apiSend("POST", "/orders/workwear", { items }),
    ["/bestellungen/meine", "/bestellungen/arbeitskleidung", "/freigaben", "/"],
    "Bestellung eingereicht.",
  );
}

export async function orderTransitionAction(id: string, status: string, note?: string): Promise<ActionState> {
  return run(
    () => apiSend("POST", `/orders/${id}/status`, { status, note }),
    ["/freigaben", "/bestellungen/meine", `/bestellungen/${id}`, "/"],
  );
}

export async function orderCommentAction(id: string, _previous: ActionState, formData: FormData): Promise<ActionState> {
  const message = String(formData.get("message") ?? "").trim();
  if (!message) {
    return { ok: false, message: "Bitte einen Text eingeben." };
  }
  return run(() => apiSend("POST", `/orders/${id}/comments`, { message }), [`/bestellungen/${id}`, "/freigaben"]);
}

export async function bulkOrderAction(type: "business_card" | "workwear"): Promise<ActionState> {
  return run(() => apiSend("POST", `/approvals/bulk/${type}`), ["/freigaben", "/bestellungen/meine", "/"]);
}

/* ----------------------------------------------------------- Tickets */

export async function createTicketAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const payload = {
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    category: String(formData.get("category") ?? "it"),
    priority: String(formData.get("priority") ?? "normal"),
  };
  return run(() => apiSend("POST", "/tickets", payload), ["/tickets", "/"], "Serviceanfrage angelegt.");
}

export async function updateTicketAction(
  id: string,
  patch: { status?: string; priority?: string; assigneeId?: string | null },
): Promise<ActionState> {
  return run(() => apiSend("PATCH", `/tickets/${id}`, patch), ["/tickets", "/"]);
}

export async function commentTicketAction(
  id: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const message = String(formData.get("message") ?? "").trim();
  if (!message) {
    return { ok: false, message: "Bitte einen Text eingeben." };
  }
  return run(() => apiSend("POST", `/tickets/${id}/comments`, { message }), ["/tickets"]);
}

/* ------------------------------------------------------ Abwesenheiten */

export async function createAbsenceAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const payload = {
    type: String(formData.get("type") ?? "urlaub"),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
    note: String(formData.get("note") ?? "") || undefined,
  };
  return run(() => apiSend("POST", "/absences", payload), ["/abwesenheiten", "/"], "Antrag eingereicht.");
}

export async function decideAbsenceAction(id: string, approve: boolean, note?: string): Promise<ActionState> {
  return run(() => apiSend("POST", `/absences/${id}/decision`, { approve, note }), ["/abwesenheiten", "/"]);
}

export async function cancelAbsenceAction(id: string): Promise<ActionState> {
  return run(() => apiSend("POST", `/absences/${id}/cancel`), ["/abwesenheiten", "/"]);
}

/* ---------------------------------------------------------- Onboarding */

export async function toggleOnboardingItemAction(id: string, done: boolean): Promise<ActionState> {
  return run(() => apiSend("PATCH", `/onboarding/items/${id}`, { done }), ["/onboarding"]);
}

export async function assignOnboardingAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const payload = {
    templateId: String(formData.get("templateId") ?? ""),
    userId: String(formData.get("userId") ?? ""),
    startDate: String(formData.get("startDate") ?? ""),
  };
  return run(() => apiSend("POST", "/onboarding/assignments", payload), ["/onboarding"], "Plan zugewiesen.");
}

/* ------------------------------------------------------------ Kalender */

export async function createEventAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const payload = {
    title: String(formData.get("title") ?? ""),
    category: String(formData.get("category") ?? "meeting"),
    startsAt: new Date(String(formData.get("startsAt") ?? "")).toISOString(),
    endsAt: new Date(String(formData.get("endsAt") ?? "")).toISOString(),
    location: String(formData.get("location") ?? "") || undefined,
    description: String(formData.get("description") ?? "") || undefined,
    audienceScopes: formData.getAll("audienceScopes").map(String).filter(Boolean),
  };
  if (payload.audienceScopes.length === 0) {
    payload.audienceScopes = ["global"];
  }
  return run(() => apiSend("POST", "/calendar", payload), ["/kalender", "/"], "Termin angelegt.");
}

export async function deleteEventAction(id: string): Promise<ActionState> {
  return run(() => apiSend("DELETE", `/calendar/${id}`), ["/kalender", "/"]);
}

/* -------------------------------------------------------------- Räume */

export async function bookRoomAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const payload = {
    roomId: String(formData.get("roomId") ?? ""),
    title: String(formData.get("title") ?? ""),
    startsAt: new Date(String(formData.get("startsAt") ?? "")).toISOString(),
    endsAt: new Date(String(formData.get("endsAt") ?? "")).toISOString(),
  };
  return run(() => apiSend("POST", "/rooms/bookings", payload), ["/raeume"], "Raum gebucht.");
}

export async function cancelRoomBookingAction(id: string): Promise<ActionState> {
  return run(() => apiSend("DELETE", `/rooms/bookings/${id}`), ["/raeume"]);
}

/* ----------------------------------------------------------- Fuhrpark */

/* -------------------------------------------------------------- Ideen */

export async function createIdeaAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const payload = {
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    category: String(formData.get("category") ?? "Allgemein"),
  };
  return run(() => apiSend("POST", "/ideas", payload), ["/ideen"], "Idee eingereicht.");
}

export async function voteIdeaAction(id: string): Promise<ActionState> {
  return run(() => apiSend("POST", `/ideas/${id}/vote`), ["/ideen"]);
}

export async function setIdeaStatusAction(id: string, status: string, decisionNote?: string): Promise<ActionState> {
  return run(() => apiSend("PATCH", `/ideas/${id}/status`, { status, decisionNote }), ["/ideen"]);
}

/* ----------------------------------------------------------- Umfragen */

export async function votePollAction(pollId: string, optionId: string): Promise<ActionState> {
  return run(() => apiSend("POST", `/polls/${pollId}/vote`, { optionId }), ["/umfragen", "/"]);
}

export async function createPollAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const payload = {
    question: String(formData.get("question") ?? ""),
    description: String(formData.get("description") ?? "") || undefined,
    options: String(formData.get("options") ?? "")
      .split("\n")
      .map((option) => option.trim())
      .filter(Boolean),
    closesAt: String(formData.get("closesAt") ?? "")
      ? new Date(String(formData.get("closesAt"))).toISOString()
      : undefined,
  };
  return run(() => apiSend("POST", "/polls", payload), ["/umfragen", "/"], "Umfrage gestartet.");
}

export async function closePollAction(id: string): Promise<ActionState> {
  return run(() => apiSend("POST", `/polls/${id}/close`), ["/umfragen", "/"]);
}

/* ---------------------------------------------------- Benachrichtigungen */

export async function markNotificationReadAction(id: string): Promise<ActionState> {
  return run(() => apiSend("POST", `/notifications/${id}/read`), ["/benachrichtigungen", "/"]);
}

export async function markAllNotificationsReadAction(): Promise<ActionState> {
  return run(() => apiSend("POST", "/notifications/read-all"), ["/benachrichtigungen", "/"]);
}

/* ------------------------------------------------------------- Profil */

export async function updateProfileAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const payload = {
    phone: String(formData.get("phone") ?? ""),
    mobile: String(formData.get("mobile") ?? ""),
    presence: String(formData.get("presence") ?? "vor Ort"),
    responsibilities: String(formData.get("responsibilities") ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  };
  return run(() => apiSend("PATCH", "/profile", payload), ["/profil", "/mitarbeiter"], "Profil gespeichert.");
}

/* ------------------------------------------------------ Administration */

export async function createUserAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const payload = {
    username: String(formData.get("username") ?? ""),
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    email: String(formData.get("email") ?? "") || undefined,
    jobTitle: String(formData.get("jobTitle") ?? "") || undefined,
    phone: String(formData.get("phone") ?? "") || undefined,
    locationId: String(formData.get("locationId") ?? "") || undefined,
    departmentId: String(formData.get("departmentId") ?? "") || undefined,
    specialtyAreaId: String(formData.get("specialtyAreaId") ?? "") || undefined,
    roles: formData.getAll("roles").map(String).filter(Boolean),
  };

  if (payload.roles.length === 0) {
    payload.roles = ["mitarbeiter"];
  }

  try {
    const result = await apiSend<{ initialPassword: string }>("POST", "/users", payload);
    revalidatePath("/admin/benutzer");
    revalidatePath("/mitarbeiter");
    return { ok: true, detail: `Konto angelegt. Startpasswort: ${result.initialPassword}` };
  } catch (error) {
    return { ok: false, message: error instanceof ApiError ? error.message : "Konto konnte nicht angelegt werden." };
  }
}

export async function updateUserStatusAction(id: string, status: "active" | "inactive"): Promise<ActionState> {
  return run(() => apiSend("PATCH", `/users/${id}`, { status }), ["/admin/benutzer", "/mitarbeiter"]);
}

export async function resetUserPasswordAction(id: string): Promise<ActionState> {
  try {
    const result = await apiSend<{ initialPassword: string }>("POST", `/users/${id}/reset-password`);
    revalidatePath("/admin/benutzer");
    return { ok: true, detail: `Neues Startpasswort: ${result.initialPassword}` };
  } catch (error) {
    return { ok: false, message: error instanceof ApiError ? error.message : "Zurücksetzen fehlgeschlagen." };
  }
}

export async function setRolePermissionsAction(roleId: string, permissions: string[]): Promise<ActionState> {
  return run(() => apiSend("PATCH", `/roles/${roleId}/permissions`, { permissions }), ["/admin/rollen"]);
}

export async function saveAuthProviderAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const payload = {
    kind: String(formData.get("kind") ?? "entra"),
    label: String(formData.get("label") ?? ""),
    directory: String(formData.get("directory") ?? ""),
    clientId: String(formData.get("clientId") ?? ""),
    // Leeres Feld heißt: den hinterlegten Schlüssel behalten.
    clientSecret: String(formData.get("clientSecret") ?? "") || undefined,
  };
  return run(() => apiSend("POST", "/anmeldeverfahren", payload), ["/admin/anmeldung"], "Zugangsdaten gespeichert.");
}

export async function setAuthProviderActiveAction(kind: string, isActive: boolean): Promise<ActionState> {
  return run(() => apiSend("PATCH", `/anmeldeverfahren/${kind}/aktiv`, { isActive }), ["/admin/anmeldung"]);
}

export async function removeAuthProviderAction(kind: string): Promise<ActionState> {
  return run(() => apiSend("DELETE", `/anmeldeverfahren/${kind}`), ["/admin/anmeldung"]);
}

export async function createRoleAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const payload = {
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    rank: Number(formData.get("rank") ?? 0),
    permissions: formData.getAll("permissions").map(String),
  };
  return run(() => apiSend("POST", "/roles", payload), ["/admin/rollen", "/admin/benutzer"], "Rolle angelegt.");
}

export async function updateRoleAction(
  roleId: string,
  input: { name?: string; description?: string; rank?: number },
): Promise<ActionState> {
  return run(() => apiSend("PATCH", `/roles/${roleId}`, input), ["/admin/rollen", "/admin/benutzer"]);
}

export async function deleteRoleAction(roleId: string): Promise<ActionState> {
  return run(() => apiSend("DELETE", `/roles/${roleId}`), ["/admin/rollen", "/admin/benutzer"]);
}

export async function upsertCycleAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const payload = {
    id: String(formData.get("id") ?? "") || undefined,
    cycleType: String(formData.get("cycleType") ?? "business_cards"),
    title: String(formData.get("title") ?? ""),
    nextOrderDate: new Date(String(formData.get("nextOrderDate") ?? "")).toISOString(),
    notes: String(formData.get("notes") ?? "") || undefined,
  };
  return run(() => apiSend("POST", "/orders/cycles", payload), ["/admin/bestelltermine", "/"], "Termin gespeichert.");
}

export async function deleteCycleAction(id: string): Promise<ActionState> {
  return run(() => apiSend("DELETE", `/orders/cycles/${id}`), ["/admin/bestelltermine", "/"]);
}

export async function upsertCatalogItemAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const payload = {
    id: String(formData.get("id") ?? "") || undefined,
    name: String(formData.get("name") ?? ""),
    category: String(formData.get("category") ?? ""),
    description: String(formData.get("description") ?? "") || undefined,
    sizes: String(formData.get("sizes") ?? "")
      .split(",")
      .map((size) => size.trim())
      .filter(Boolean),
    isActive: formData.get("isActive") === "on",
  };
  return run(
    () => apiSend("POST", "/orders/catalog/workwear", payload),
    ["/admin/katalog", "/bestellungen/arbeitskleidung"],
    "Artikel gespeichert.",
  );
}

export async function upsertFieldDefinitionAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const payload = {
    id: String(formData.get("id") ?? "") || undefined,
    key: String(formData.get("key") ?? ""),
    label: String(formData.get("label") ?? ""),
    fieldType: String(formData.get("fieldType") ?? "text"),
    sortOrder: Number(formData.get("sortOrder") ?? 0),
    isRequired: formData.get("isRequired") === "on",
    isActive: formData.get("isActive") === "on",
    options: String(formData.get("options") ?? "")
      .split(",")
      .map((option) => option.trim())
      .filter(Boolean),
    helpText: String(formData.get("helpText") ?? "") || undefined,
  };
  return run(
    () => apiSend("POST", "/orders/catalog/business-card-fields", payload),
    ["/admin/formulare", "/bestellungen/visitenkarten"],
    "Formularfeld gespeichert.",
  );
}

export async function createDocumentAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const payload = {
    title: String(formData.get("title") ?? ""),
    category: String(formData.get("category") ?? ""),
    description: String(formData.get("description") ?? "") || undefined,
    fileType: String(formData.get("fileType") ?? "pdf"),
    url: String(formData.get("url") ?? ""),
    audienceScopes: formData.getAll("audienceScopes").map(String).filter(Boolean),
  };
  if (payload.audienceScopes.length === 0) {
    payload.audienceScopes = ["global"];
  }
  return run(() => apiSend("POST", "/documents", payload), ["/dokumente", "/admin/dokumente"], "Dokument gespeichert.");
}

export async function deleteDocumentAction(id: string): Promise<ActionState> {
  return run(() => apiSend("DELETE", `/documents/${id}`), ["/dokumente", "/admin/dokumente"]);
}

export async function createWikiAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const payload = {
    title: String(formData.get("title") ?? ""),
    category: String(formData.get("category") ?? ""),
    content: String(formData.get("content") ?? ""),
    tags: String(formData.get("tags") ?? "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
  };
  return run(() => apiSend("POST", "/wiki", payload), ["/wissen"], "Artikel gespeichert.");
}

export async function createQuickLinkAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const payload = {
    label: String(formData.get("label") ?? ""),
    url: String(formData.get("url") ?? ""),
    description: String(formData.get("description") ?? "") || undefined,
    icon: String(formData.get("icon") ?? "Link2"),
    sortOrder: Number(formData.get("sortOrder") ?? 0),
  };
  return run(() => apiSend("POST", "/quicklinks", payload), ["/schnellzugriffe", "/"], "Schnellzugriff gespeichert.");
}

export async function deleteQuickLinkAction(id: string): Promise<ActionState> {
  return run(() => apiSend("DELETE", `/quicklinks/${id}`), ["/schnellzugriffe", "/"]);
}

/* ------------------------------------------------------------ Schichtplan */

export async function createShiftAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const payload = {
    label: String(formData.get("label") ?? ""),
    startsAt: new Date(String(formData.get("startsAt") ?? "")).toISOString(),
    endsAt: new Date(String(formData.get("endsAt") ?? "")).toISOString(),
    locationId: String(formData.get("locationId") ?? "") || undefined,
    departmentId: String(formData.get("departmentId") ?? "") || undefined,
    assigneeId: String(formData.get("assigneeId") ?? "") || undefined,
    note: String(formData.get("note") ?? "") || undefined,
  };
  return run(() => apiSend("POST", "/schichtplan", payload), ["/schichtplan", "/"], "Schicht angelegt.");
}

export async function deleteShiftAction(id: string): Promise<ActionState> {
  return run(() => apiSend("DELETE", `/schichtplan/${id}`), ["/schichtplan"]);
}

export async function requestSwapAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const payload = {
    shiftId: String(formData.get("shiftId") ?? ""),
    targetId: String(formData.get("targetId") ?? ""),
    note: String(formData.get("note") ?? "") || undefined,
  };
  return run(() => apiSend("POST", "/diensttausch", payload), ["/schichtplan"], "Anfrage ist raus.");
}

export async function respondSwapAction(id: string, accept: boolean): Promise<ActionState> {
  return run(() => apiSend("POST", `/diensttausch/${id}/antwort`, { accept }), ["/schichtplan", "/"]);
}

export async function decideSwapAction(id: string, approve: boolean, note?: string): Promise<ActionState> {
  return run(() => apiSend("POST", `/diensttausch/${id}/freigabe`, { approve, note }), ["/schichtplan", "/"]);
}

export async function withdrawSwapAction(id: string): Promise<ActionState> {
  return run(() => apiSend("POST", `/diensttausch/${id}/zurueckziehen`), ["/schichtplan"]);
}

/* --------------------------------------------------- Fundsachen und Schlüssel */

export async function createCustodyAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const foundAt = String(formData.get("foundAt") ?? "");
  const payload = {
    kind: String(formData.get("kind") ?? "fundsache"),
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? "") || undefined,
    storagePlace: String(formData.get("storagePlace") ?? "") || undefined,
    locationId: String(formData.get("locationId") ?? "") || undefined,
    foundAt: foundAt ? new Date(foundAt).toISOString() : undefined,
    foundPlace: String(formData.get("foundPlace") ?? "") || undefined,
  };
  return run(() => apiSend("POST", "/verwahrung", payload), ["/verwahrung"], "Eintrag aufgenommen.");
}

export async function handOutCustodyAction(
  id: string,
  input: { personId?: string; personName?: string; note?: string },
): Promise<ActionState> {
  return run(() => apiSend("POST", `/verwahrung/${id}/ausgabe`, input), ["/verwahrung"]);
}

export async function takeBackCustodyAction(id: string, note?: string): Promise<ActionState> {
  return run(() => apiSend("POST", `/verwahrung/${id}/ruecknahme`, { note }), ["/verwahrung"]);
}

export async function discardCustodyAction(id: string, note?: string): Promise<ActionState> {
  return run(() => apiSend("POST", `/verwahrung/${id}/entsorgung`, { note }), ["/verwahrung"]);
}

/* ----------------------------------------------------------- Essensbestellung */

export async function createMealOfferAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  // Die Wahlmöglichkeiten kommen als parallele Felder aus dem Formular.
  const namen = formData.getAll("optionName").map(String);
  const preise = formData.getAll("optionPrice").map(String);
  const options = namen
    .map((name, index) => ({
      name: name.trim(),
      priceCents: Math.round(Number(String(preise[index] ?? "0").replace(",", ".")) * 100),
    }))
    .filter((option) => option.name.length > 0);

  const payload = {
    date: new Date(String(formData.get("date") ?? "")).toISOString(),
    provider: String(formData.get("provider") ?? ""),
    orderDeadline: new Date(String(formData.get("orderDeadline") ?? "")).toISOString(),
    locationId: String(formData.get("locationId") ?? "") || undefined,
    note: String(formData.get("note") ?? "") || undefined,
    options,
  };
  return run(() => apiSend("POST", "/essen/angebote", payload), ["/essen", "/"], "Angebot steht.");
}

export async function deleteMealOfferAction(id: string): Promise<ActionState> {
  return run(() => apiSend("DELETE", `/essen/angebote/${id}`), ["/essen"]);
}

export async function orderMealAction(offerId: string, optionId: string, quantity = 1): Promise<ActionState> {
  return run(() => apiSend("POST", `/essen/angebote/${offerId}/bestellung`, { optionId, quantity }), ["/essen", "/"]);
}

export async function cancelMealAction(offerId: string): Promise<ActionState> {
  return run(() => apiSend("DELETE", `/essen/angebote/${offerId}/bestellung`), ["/essen", "/"]);
}
