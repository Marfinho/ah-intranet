import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../core/prisma.service";
import {
  ConnectorError,
  fetchWithTimeout,
  requireFields,
  type CheckResult,
  type ConnectorAdapter,
  type ConnectorContext,
  type SyncResult,
} from "../adapter";

/**
 * mobile.de Seller-API.
 *
 * Umsetzung nach der öffentlichen Dokumentation unter
 * https://services.mobile.de/docs/seller-api.html:
 * - HTTP-Basic-Authentifizierung, Zugangsdaten je API-Benutzer
 * - `GET /seller-api/sellers/:sellerId/ads` liefert alle Inserate des Händlers
 * - Aushandlung über die herstellerspezifischen Medientypen
 *   `application/vnd.de.mobile.api+json`
 *
 * Die Antwortstruktur wird bewusst tolerant ausgewertet: mobile.de liefert je
 * nach Feld mal Skalare, mal Objekte mit `@value`/`value`. Ein einzelner
 * unerwarteter Datensatz darf den gesamten Abgleich nicht scheitern lassen -
 * er wird gezählt und übersprungen.
 */
@Injectable()
export class MobileDeAdapter implements ConnectorAdapter {
  readonly key = "mobile_de";

  private static readonly MEDIA_TYPE = "application/vnd.de.mobile.api+json";
  private static readonly DEFAULT_BASE_URL = "https://services.mobile.de";

  constructor(private readonly prisma: PrismaService) {}

  async check(context: ConnectorContext): Promise<CheckResult> {
    requireFields(context, ["sellerId", "username", "password"]);

    const response = await this.request(context, this.adsPath(context));
    if (response.status === 401 || response.status === 403) {
      return { ok: false, message: "Zugangsdaten wurden von mobile.de abgelehnt (HTTP " + response.status + ")." };
    }
    if (response.status === 404) {
      return { ok: false, message: "Händler-ID unbekannt: mobile.de meldet HTTP 404." };
    }
    if (!response.ok) {
      return { ok: false, message: `mobile.de antwortet mit HTTP ${response.status}.` };
    }

    const ads = this.extractAds(await response.json());
    return { ok: true, message: `Verbindung steht. ${ads.length} Inserat(e) im Händlerkonto.` };
  }

  async run(capability: string, context: ConnectorContext): Promise<SyncResult> {
    if (capability !== "vehicles.pull") {
      throw new ConnectorError(`Unbekannte Fähigkeit "${capability}" für mobile.de.`);
    }
    return this.pullVehicles(context);
  }

  private async pullVehicles(context: ConnectorContext): Promise<SyncResult> {
    requireFields(context, ["sellerId", "username", "password"]);

    const response = await this.request(context, this.adsPath(context));
    if (!response.ok) {
      throw new ConnectorError(
        response.status === 401 || response.status === 403
          ? "mobile.de hat die Zugangsdaten abgelehnt."
          : `mobile.de antwortet mit HTTP ${response.status}.`,
      );
    }

    const ads = this.extractAds(await response.json());
    const seen: string[] = [];
    let failed = 0;

    for (const ad of ads) {
      try {
        const listing = this.toListing(ad);
        if (!listing) {
          failed += 1;
          continue;
        }

        await this.prisma.vehicleListing.upsert({
          where: { connectorKey_externalId: { connectorKey: this.key, externalId: listing.externalId } },
          update: { ...listing, connectorKey: this.key, syncedAt: new Date() },
          create: { ...listing, connectorKey: this.key },
        });
        seen.push(listing.externalId);
      } catch {
        failed += 1;
      }
    }

    // Inserate, die es bei mobile.de nicht mehr gibt, fliegen aus dem Bestand.
    const removed = await this.prisma.vehicleListing.deleteMany({
      where: { connectorKey: this.key, externalId: { notIn: seen.length > 0 ? seen : ["__keine__"] } },
    });

    return {
      itemsProcessed: seen.length,
      itemsFailed: failed,
      message: `${seen.length} Inserat(e) übernommen, ${removed.count} entfernt${failed > 0 ? `, ${failed} fehlerhaft` : ""}.`,
      detail: { removed: removed.count },
    };
  }

  /* ----------------------------------------------------------- HTTP */

  private baseUrl(context: ConnectorContext): string {
    return (context.settings.baseUrl?.trim() || MobileDeAdapter.DEFAULT_BASE_URL).replace(/\/+$/, "");
  }

  private adsPath(context: ConnectorContext): string {
    return `/seller-api/sellers/${encodeURIComponent(context.settings.sellerId)}/ads`;
  }

  private request(context: ConnectorContext, path: string): Promise<Response> {
    const credentials = Buffer.from(`${context.settings.username}:${context.secrets.password}`).toString("base64");

    return fetchWithTimeout(`${this.baseUrl(context)}${path}`, {
      method: "GET",
      headers: {
        authorization: `Basic ${credentials}`,
        accept: MobileDeAdapter.MEDIA_TYPE,
        "accept-language": "de",
      },
      timeoutMs: 30_000,
    });
  }

  /* --------------------------------------------------------- Mapping */

  /** Die Inseratsliste steckt je nach Antwortvariante an unterschiedlicher Stelle. */
  private extractAds(payload: unknown): Record<string, unknown>[] {
    if (Array.isArray(payload)) {
      return payload as Record<string, unknown>[];
    }
    if (!payload || typeof payload !== "object") {
      return [];
    }

    const body = payload as Record<string, unknown>;
    for (const key of ["ads", "ad", "search-result", "searchResult"]) {
      const candidate = body[key];
      if (Array.isArray(candidate)) {
        return candidate as Record<string, unknown>[];
      }
      if (candidate && typeof candidate === "object") {
        const nested = (candidate as Record<string, unknown>).ads ?? (candidate as Record<string, unknown>).ad;
        if (Array.isArray(nested)) {
          return nested as Record<string, unknown>[];
        }
      }
    }
    return [];
  }

  /** mobile.de verpackt viele Werte als `{ "@value": ... }` oder `{ value: ... }`. */
  private scalar(value: unknown): string | undefined {
    if (value === null || value === undefined) return undefined;
    if (typeof value === "string" || typeof value === "number") return String(value);
    if (typeof value === "object") {
      const record = value as Record<string, unknown>;
      for (const key of ["@value", "value", "local-description", "localDescription", "@key"]) {
        const inner = record[key];
        if (typeof inner === "string" || typeof inner === "number") {
          return String(inner);
        }
      }
    }
    return undefined;
  }

  private numeric(value: unknown): number | undefined {
    const raw = this.scalar(value);
    if (raw === undefined) return undefined;
    const parsed = Number(raw.replace(/[^0-9.,-]/g, "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private toListing(ad: Record<string, unknown>) {
    const vehicle = (ad.vehicle ?? ad) as Record<string, unknown>;

    const externalId =
      this.scalar(ad.mobileAdId) ?? this.scalar(ad["mobile-ad-id"]) ?? this.scalar(ad.id) ?? this.scalar(ad.key);
    if (!externalId) {
      return null;
    }

    const make = this.scalar(vehicle.make) ?? "Unbekannt";
    const model = this.scalar(vehicle.model) ?? "";
    const priceNode = (ad.price ?? vehicle.price) as Record<string, unknown> | undefined;

    const firstRegistrationRaw =
      this.scalar(vehicle.firstRegistration) ?? this.scalar(vehicle["first-registration"]);

    const images = (ad.images ?? ad.image) as Record<string, unknown> | undefined;
    const firstImage = Array.isArray(images)
      ? (images[0] as Record<string, unknown> | undefined)
      : ((images?.image as Record<string, unknown>[] | undefined)?.[0] ??
        (images as Record<string, unknown> | undefined));

    return {
      externalId,
      vin: this.scalar(vehicle.vin) ?? null,
      make,
      model,
      title:
        this.scalar(ad.description) ??
        this.scalar(ad.title) ??
        [make, model].filter(Boolean).join(" ") ??
        externalId,
      price: this.numeric(priceNode?.consumerPriceGross ?? priceNode?.["consumer-price-gross"] ?? priceNode) ?? null,
      currency: this.scalar(priceNode?.currency) ?? "EUR",
      mileageKm: this.numeric(vehicle.mileage) ?? null,
      firstRegistration: this.parseRegistration(firstRegistrationRaw),
      fuel: this.scalar(vehicle.fuel) ?? null,
      gearbox: this.scalar(vehicle.gearbox) ?? null,
      powerKw: this.numeric(vehicle.power) ?? null,
      url: this.scalar(ad.detailPageUrl) ?? this.scalar(ad["detail-page-url"]) ?? null,
      imageUrl: firstImage ? (this.scalar(firstImage.ref) ?? this.scalar(firstImage.url) ?? null) : null,
      raw: ad as never,
    };
  }

  /** mobile.de liefert die Erstzulassung als `YYYY-MM` oder `YYYYMM`. */
  private parseRegistration(raw: string | undefined): Date | null {
    if (!raw) return null;
    const match = /^(\d{4})-?(\d{2})?/.exec(raw);
    if (!match) return null;
    const year = Number(match[1]);
    const month = match[2] ? Number(match[2]) : 1;
    if (year < 1900 || year > 2100 || month < 1 || month > 12) return null;
    return new Date(Date.UTC(year, month - 1, 1));
  }
}
