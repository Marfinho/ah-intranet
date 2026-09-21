import { NextResponse } from "next/server";
import { ApiError, apiGet } from "@/lib/api";
import { getSession } from "@/lib/session";

/**
 * Auskunft über die eigenen Daten, als Datei.
 *
 * Gegenstück zu `/admin/datenschutz/auskunft/[userId]`, aber ohne Parameter
 * und ohne Recht: Art. 15 DSGVO steht jeder betroffenen Person zu, und wer den
 * Weg über die Administration gehen muss, stellt die Frage oft gar nicht erst.
 * Welche Person gemeint ist, entscheidet die Sitzung - nicht die Adresse.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Nicht angemeldet" }, { status: 401 });
  }

  try {
    const auskunft = await apiGet<Record<string, unknown>>("/meine-daten/auskunft");

    return new NextResponse(JSON.stringify(auskunft, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="meine-daten-${session.username}.json"`,
      },
    });
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    return NextResponse.json({ message: error instanceof Error ? error.message : "Fehler" }, { status });
  }
}
