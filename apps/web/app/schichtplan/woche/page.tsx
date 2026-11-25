import Link from "next/link";
import type {
  ArbeitszeitBefund,
  BetriebstagEintrag,
  EmployeeDirectoryEntry,
  PlanEntwurf,
  PlanEntwurfKopf,
  SchichtartItem,
  ShiftItem,
} from "@ah-intranet/shared";
import { lokalesDatum, tagVerschieben, tageZwischen, wochenStart } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { Section } from "@/components/ui";
import { Entwurfsplan } from "./entwurfsplan";
import { Wochenplan } from "./wochenplan";
import { ApiError, apiGet } from "@/lib/api";
import { can, requireModule } from "@/lib/session";

const DATUM = /^\d{4}-\d{2}-\d{2}$/;

function bezeichnung(montag: string, sonntag: string): string {
  const format = (datum: string) =>
    new Date(`${datum}T00:00:00Z`).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "UTC",
    });
  return `${format(montag)} – ${format(sonntag)}`;
}

export default async function WochenansichtPage(props: {
  searchParams: Promise<{ datum?: string; entwurf?: string; info?: string }>;
}) {
  const searchParams = await props.searchParams;
  const session = await requireModule("shifts");
  const darfPflegen = can(session, "shifts.manage");

  // Ein Entwurf bestimmt die Woche; ohne Entwurf gilt das gewünschte Datum oder heute.
  let entwurf: PlanEntwurf | null = null;
  let entwurfFehler: string | null = null;
  if (darfPflegen && searchParams.entwurf) {
    try {
      entwurf = await apiGet<PlanEntwurf>(`/schichtplanung/entwuerfe/${encodeURIComponent(searchParams.entwurf)}`);
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      entwurfFehler = error.isMissing
        ? "Diesen Entwurf gibt es nicht mehr - vielleicht wurde er verworfen oder gespeichert."
        : error.message;
    }
  }

  const heute = lokalesDatum(new Date());
  const gewuenscht =
    entwurf?.von ?? (searchParams.datum && DATUM.test(searchParams.datum) ? searchParams.datum : heute);
  const montag = wochenStart(gewuenscht);
  const sonntag = tagVerschieben(montag, 6);
  const tage = tageZwischen(montag, sonntag);

  // Etwas Rand um die Woche: Nachtschichten reichen über die Tagesgrenze, der Server schneidet nach Serverzeit.
  const von = tagVerschieben(montag, -2);
  const bis = tagVerschieben(montag, 8);
  const jahre = [...new Set([montag.slice(0, 4), sonntag.slice(0, 4)])];

  const [schichten, befunde, kalender, directory, arten, entwuerfe] = await Promise.all([
    apiGet<ShiftItem[]>(`/schichtplan?from=${von}&to=${bis}`),
    apiGet<ArbeitszeitBefund[]>(`/schichtplanung/pruefung?von=${montag}&bis=${sonntag}`),
    Promise.all(jahre.map((jahr) => apiGet<BetriebstagEintrag[]>(`/betriebskalender/tage?jahr=${jahr}`))).then(
      (listen) => listen.flat(),
    ),
    darfPflegen ? apiGet<{ items: EmployeeDirectoryEntry[] }>("/directory") : Promise.resolve({ items: [] }),
    darfPflegen ? apiGet<SchichtartItem[]>("/schichtplanung/arten") : Promise.resolve([]),
    darfPflegen
      ? apiGet<PlanEntwurfKopf[]>(`/schichtplanung/entwuerfe?von=${montag}&bis=${sonntag}`)
      : Promise.resolve([]),
  ]);

  // Schattiert werden Tage, die im ganzen Haus frei sind; standortbezogene Einträge färben nicht die ganze Spalte.
  const freieTage = Object.fromEntries(
    kalender
      .filter((eintrag) => eintrag.arbeitsfrei && eintrag.locationId === null)
      .map((eintrag) => [eintrag.datum, eintrag.name]),
  );

  const link = (datum: string) => `/schichtplan/woche?datum=${datum}`;

  return (
    <AppShell
      title="Wochenansicht"
      subtitle={
        entwurf
          ? "Entwurf - der echte Plan bleibt unverändert, bis Sie speichern"
          : "Schichten auf der Zeitachse, überlappende nebeneinander"
      }
    >
      {searchParams.info ? (
        <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {searchParams.info}
        </p>
      ) : null}
      {entwurfFehler ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{entwurfFehler}</p>
      ) : null}

      <Section
        title={bezeichnung(montag, sonntag)}
        subtitle={
          entwurf
            ? `Entwurf „${entwurf.name}“`
            : darfPflegen
              ? "Veröffentlichter Plan - zum Ändern einen Entwurf beginnen"
              : "Lesezugriff - gepflegt wird der Plan von der Führungskraft"
        }
        action={
          <div className="flex flex-wrap items-center gap-3 text-sm font-semibold">
            <Link href={link(tagVerschieben(montag, -7))} className="text-brand-700 hover:underline">
              ← Vorwoche
            </Link>
            <Link href={link(heute)} className="text-brand-700 hover:underline">
              Heute
            </Link>
            <Link href={link(tagVerschieben(montag, 7))} className="text-brand-700 hover:underline">
              Folgewoche →
            </Link>
            <Link href="/schichtplan" className="text-slate-600 hover:underline">
              Liste
            </Link>
          </div>
        }
      >
        {entwurf ? (
          <Entwurfsplan
            key={entwurf.id}
            start={entwurf}
            tage={tage}
            heute={heute}
            live={schichten}
            freieTage={freieTage}
            people={directory.items.map((person) => ({ id: person.id, name: person.displayName }))}
            arten={arten.filter((art) => art.aktiv)}
            meId={session.id}
          />
        ) : (
          <Wochenplan
            tage={tage}
            heute={heute}
            schichten={schichten}
            darfPflegen={darfPflegen}
            freieTage={freieTage}
            hinweise={befunde.map((befund) => ({
              userId: befund.userId,
              datum: befund.datum,
              schwere: befund.schwere,
            }))}
            entwuerfe={entwuerfe}
          />
        )}
      </Section>
    </AppShell>
  );
}
