import type { SchluesselAmpel, SchluesselUebersicht } from "@ah-intranet/shared";
import { SCHLUESSEL_STUFEN } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { Section } from "@/components/ui";
import { StufeZeile } from "./stufe-zeile";
import { MeldungEinstellung } from "./meldung-einstellung";
import { apiGet } from "@/lib/api";
import { can, requireSession } from "@/lib/session";

const AMPEL: Record<SchluesselAmpel, { text: string; stil: string }> = {
  gruen: { text: "vollständig besetzt", stil: "bg-emerald-100 text-emerald-800" },
  gelb: { text: "Mindestbesetzung", stil: "bg-amber-100 text-amber-800" },
  rot: { text: "unterbesetzt", stil: "bg-rose-100 text-rose-800" },
};

/** Für alle lesbar: wer wofür zuständig ist, soll jede wissen. Pflegen darf nur, wer Konten verwaltet. */
export default async function SchluesselfunktionenPage() {
  const session = await requireSession();
  const darfPflegen = can(session, "users.manage");
  const daten = await apiGet<SchluesselUebersicht>("/schluessel");

  return (
    <AppShell
      title="Schlüsselfunktionen"
      subtitle="Zentrale Aufgaben mit Key User, zwei Vertretungen und der Geschäftsführung als letzter Stufe"
    >
      {daten.offeneEskalationen && daten.offeneEskalationen.length > 0 ? (
        <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-900">
          <strong>Heute niemand erreichbar:</strong> {daten.offeneEskalationen.join(", ")}. Die Zuständigkeit liegt bei
          der Geschäftsführung.
        </p>
      ) : null}

      {!daten.geschaeftsfuehrungBesetzt ? (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Niemand trägt das Recht „Eskalationen der Schlüsselfunktionen erhalten". Eskaliert wird deshalb an die
          Benutzerverwaltung. Die Rolle „Geschäftsführung" trägt dieses Recht.
        </p>
      ) : null}

      <div className="space-y-4">
        {daten.funktionen.map((funktion) => (
          <Section
            key={funktion.key}
            title={funktion.name}
            subtitle={funktion.beschreibung}
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className={`badge ${AMPEL[funktion.ampel].stil}`}>{AMPEL[funktion.ampel].text}</span>
              <p className="text-sm text-slate-600">
                {funktion.zustaendig
                  ? `Heute zuständig: ${funktion.zustaendig.name} (${funktion.zustaendig.stufe})`
                  : "Heute ist niemand erreichbar - Geschäftsführung"}
              </p>
            </div>

            <ul className="mt-3 divide-y divide-slate-100">
              {SCHLUESSEL_STUFEN.map(({ stufe, name }) => {
                const eintrag = funktion.stufen[stufe];
                const belegt = new Set(
                  funktion.stufen.filter((anderer) => anderer.stufe !== stufe && anderer.userId).map((a) => a.userId),
                );
                return (
                  <StufeZeile
                    key={stufe}
                    funktion={funktion.key}
                    stufe={stufe}
                    stufenName={name}
                    eintrag={eintrag}
                    kandidaten={funktion.kandidaten.filter((kandidat) => !belegt.has(kandidat.id))}
                    darfPflegen={darfPflegen}
                  />
                );
              })}
            </ul>
            {darfPflegen ? (
              <p className="mt-3 text-xs text-slate-500">
                Einsetzen kann man nur Konten mit dem Recht „{funktion.recht}" - sonst könnte die Vertretung im Ernstfall
                nichts tun.
              </p>
            ) : null}
          </Section>
        ))}
      </div>

      {darfPflegen ? (
        <Section title="Einstellung" subtitle="Gilt für das ganze Haus">
          <MeldungEinstellung aktuell={daten.vertretungsMeldung} />
        </Section>
      ) : null}
    </AppShell>
  );
}
