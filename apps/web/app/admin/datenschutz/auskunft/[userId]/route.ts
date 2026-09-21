import { NextResponse } from "next/server";
import { ApiError, apiGet } from "@/lib/api";
import { getSession } from "@/lib/session";

/**
 * Auskunft als Datei zum Herunterladen.
 *
 * Bewusst ein Route Handler statt einer Seite: die Auskunft soll als Datei
 * herausgehen, die man der Person unverändert aushändigen kann - nicht als
 * Bildschirmansicht, aus der jemand abtippt.
 */
export async function GET(_request: Request, { params: paramsPromise }: { params: Promise<{ userId: string }> }) {
  const params = await paramsPromise;
  const session = await getSession();
  if (!session?.permissions.includes("privacy.manage")) {
    return NextResponse.json({ message: "Nicht berechtigt" }, { status: 403 });
  }

  try {
    const auskunft = await apiGet<Record<string, unknown>>(`/datenschutz/auskunft/${params.userId}`);

    return new NextResponse(JSON.stringify(auskunft, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="auskunft-${params.userId}.json"`,
      },
    });
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    return NextResponse.json({ message: error instanceof Error ? error.message : "Fehler" }, { status });
  }
}
