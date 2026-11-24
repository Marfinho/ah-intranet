import { Controller, Get, NotFoundException, Query } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { Public } from "./decorators";
import { TenantService } from "./tenant.service";

/**
 * Antwort auf die `ask`-Anfrage von Caddy (On-Demand-TLS).
 *
 * Ein Wildcard-Zertifikat bräuchte eine DNS-Anbindung beim Domainanbieter; so
 * holt Caddy je Haus beim ersten Aufruf ein eigenes bei Let's Encrypt. Ohne
 * diese Rückfrage ließe sich der Server mit beliebigen Namen dazu bringen,
 * Zertifikate anzufordern, bis Let's Encrypt die Ausstellung sperrt.
 *
 * Nur im internen Netz erreichbar: der Proxy leitet ausschließlich an das
 * Frontend weiter, die API selbst hat keinen öffentlichen Port.
 */
@Controller("tls")
export class TlsController {
  constructor(private readonly tenants: TenantService) {}

  @Public()
  @SkipThrottle()
  @Get("erlaubt")
  async erlaubt(@Query("domain") domain?: string): Promise<{ ok: true }> {
    const name = domain?.trim().toLowerCase();
    const basis = process.env.BASE_DOMAIN?.trim().toLowerCase();

    // Die Basisadresse selbst trägt die Landingpage und gehört keinem Haus.
    if (name && (name === basis || (await this.tenants.kenntHost(name)))) {
      return { ok: true };
    }
    throw new NotFoundException();
  }
}
