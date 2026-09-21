import { Injectable, Logger } from "@nestjs/common";
import type { OutlookCalendarEvent, OutlookCalendarState } from "@ah-intranet/shared";
import { PrismaService } from "../../core/prisma.service";
import { entschluessele, istVerschluesselungMoeglich, verschluessele } from "../../core/geheimnis";
import { refreshAccessToken } from "../../core/microsoft-identity";
import type { RequestUser } from "../../core/request-user";

const VORSCHAU_TAGE = 30;

interface GraphEvent {
  id: string;
  subject?: string;
  start: { dateTime: string };
  end: { dateTime: string };
  isAllDay?: boolean;
  location?: { displayName?: string };
  organizer?: { emailAddress?: { name?: string } };
  webLink: string;
}

/**
 * Lesender Zugriff auf den Outlook-Kalender per Microsoft Graph.
 *
 * Bewusst ohne eigene Ablage: Termine kommen bei jedem Aufruf frisch von
 * Microsoft, keine Kopie liegt in der Datenbank. Für ein Postfach mit vielen
 * Terminen kostet das eine zusätzliche Anfrage pro Seitenaufruf - der Preis
 * für "es gibt keine zweite, möglicherweise veraltete Wahrheit".
 */
@Injectable()
export class OutlookCalendarService {
  private readonly logger = new Logger(OutlookCalendarService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getEvents(user: RequestUser): Promise<OutlookCalendarState> {
    if (!istVerschluesselungMoeglich()) {
      return { verbunden: false, events: [] };
    }

    const account = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { msRefreshToken: true },
    });
    if (!account?.msRefreshToken) {
      return { verbunden: false, events: [] };
    }

    const provider = await this.prisma.tenantAuthProvider.findFirst({ where: { kind: "entra", isActive: true } });
    if (!provider?.clientSecret) {
      return { verbunden: false, events: [] };
    }

    let tokens;
    try {
      tokens = await refreshAccessToken({
        directory: provider.directory,
        clientId: provider.clientId,
        clientSecret: entschluessele(provider.clientSecret),
        refreshToken: entschluessele(account.msRefreshToken),
      });
    } catch (fehler) {
      this.logger.warn(`Zugriffstoken für Outlook-Kalender ließ sich nicht erneuern: ${(fehler as Error).message}`);
      return {
        verbunden: false,
        events: [],
        fehler: "Die Verbindung zu Outlook ist nicht mehr gültig. Bitte einmal erneut über Microsoft anmelden.",
      };
    }

    // Microsoft rotiert den Refresh-Token häufig mit - der alte wird dabei ungültig.
    if (tokens.refreshToken) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { msRefreshToken: verschluessele(tokens.refreshToken), msTokenUpdatedAt: new Date() },
      });
    }

    const von = new Date();
    const bis = new Date(Date.now() + VORSCHAU_TAGE * 24 * 60 * 60 * 1000);
    const url = new URL("https://graph.microsoft.com/v1.0/me/calendarview");
    url.searchParams.set("startDateTime", von.toISOString());
    url.searchParams.set("endDateTime", bis.toISOString());
    url.searchParams.set("$top", "50");
    url.searchParams.set("$orderby", "start/dateTime");
    url.searchParams.set("$select", "id,subject,start,end,isAllDay,location,organizer,webLink");

    let response: Response;
    try {
      // Ohne "Prefer: outlook.timezone" liefert Graph UTC - das lässt sich ohne
      // eine Zeitzonenbibliothek verlässlich zurückrechnen. Die Anzeige im
      // lokalen Zeitraum übernimmt das Frontend, wie beim internen Kalender.
      response = await fetch(url, { headers: { Authorization: `Bearer ${tokens.accessToken}` } });
    } catch {
      return { verbunden: true, events: [], fehler: "Outlook ist gerade nicht erreichbar." };
    }

    if (!response.ok) {
      this.logger.warn(`Microsoft Graph antwortete mit ${response.status} beim Abruf des Kalenders`);
      return { verbunden: true, events: [], fehler: "Der Outlook-Kalender ließ sich nicht abrufen." };
    }

    const body = (await response.json()) as { value?: GraphEvent[] };
    return { verbunden: true, events: (body.value ?? []).map(toOutlookEvent) };
  }
}

function toOutlookEvent(event: GraphEvent): OutlookCalendarEvent {
  return {
    id: event.id,
    title: event.subject?.trim() || "(ohne Titel)",
    startsAt: new Date(event.start.dateTime + "Z").toISOString(),
    endsAt: new Date(event.end.dateTime + "Z").toISOString(),
    isAllDay: Boolean(event.isAllDay),
    location: event.location?.displayName?.trim() || null,
    organizer: event.organizer?.emailAddress?.name?.trim() || null,
    webLink: event.webLink,
  };
}
