import Link from "next/link";
import { getModule } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { EmptyState, Section } from "@/components/ui";
import { requireSession } from "@/lib/session";

export default async function ModuleDisabledPage({ searchParams }: { searchParams: { m?: string } }) {
  const session = await requireSession();
  const module = searchParams.m ? getModule(searchParams.m) : undefined;
  const isAdmin = session.roles.includes("admin");

  return (
    <AppShell title="Modul deaktiviert" subtitle="Dieser Bereich steht derzeit nicht zur Verfügung">
      <Section title={module?.label ?? "Unbekanntes Modul"} subtitle={module?.description ?? ""}>
        <EmptyState
          title="Der Bereich wurde abgeschaltet"
          detail={
            isAdmin
              ? "Sie können das Modul in der Modulsteuerung wieder aktivieren. Die Daten sind erhalten geblieben."
              : "Die Administration hat diesen Bereich deaktiviert. Bei Fragen wenden Sie sich bitte an die IT."
          }
        />

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Zum Dashboard
          </Link>
          {isAdmin ? (
            <Link
              href="/admin/module"
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Zur Modulsteuerung
            </Link>
          ) : null}
        </div>
      </Section>
    </AppShell>
  );
}
