import { NextResponse } from "next/server";
import { apiBaseUrl, tenantHostHeader } from "@/lib/api";

/**
 * Reicht das Logo des Mandanten an den Browser durch.
 *
 * Der Browser darf die API nie direkt ansprechen (siehe `apps/web/lib/api.ts`)
 * - auch ein Bild nicht. Diese Route läuft deshalb, wie jede Server-seitige
 * Anfrage, unter der Adresse der Anwendung selbst und reicht nur den
 * ursprünglichen Host weiter, damit die API das richtige Haus auflöst.
 */
export async function GET() {
  const response = await fetch(`${apiBaseUrl()}/branding/logo`, {
    headers: tenantHostHeader(),
    cache: "no-store",
  });

  if (!response.ok) {
    return new NextResponse(null, { status: 404 });
  }

  const bild = await response.arrayBuffer();
  return new NextResponse(bild, {
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "application/octet-stream",
      "Cache-Control": "no-store",
    },
  });
}
