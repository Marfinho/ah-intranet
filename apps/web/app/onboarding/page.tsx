import type { OnboardingAssignment, OnboardingTemplate } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { EmptyState, ProgressBar, Section, Tag } from "@/components/ui";
import { OnboardingChecklist } from "./onboarding-checklist";
import { apiGet } from "@/lib/api";
import { requireModule } from "@/lib/session";
import { formatDate } from "@/lib/utils";

interface OnboardingResponse {
  templates: OnboardingTemplate[];
  assignments: OnboardingAssignment[];
  canManage: boolean;
}

export default async function OnboardingPage() {
  await requireModule("onboarding");
  const data = await apiGet<OnboardingResponse>("/onboarding");

  return (
    <AppShell title="Onboarding" subtitle="Einarbeitungspläne mit Checklisten und Fortschritt">
      <Section
        title={data.canManage ? "Laufende Einarbeitungen" : "Mein Einarbeitungsplan"}
        subtitle="Erledigte Punkte werden sofort gespeichert"
      >
        {data.assignments.length === 0 ? (
          <EmptyState
            title="Kein Plan zugewiesen"
            detail="Sobald Ihnen eine Einarbeitung zugewiesen wurde, erscheint hier Ihre Checkliste."
          />
        ) : (
          <div className="space-y-5">
            {data.assignments.map((assignment) => (
              <div key={assignment.id} className="rounded-2xl border border-slate-200 p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{assignment.templateName}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {assignment.employee} · Start {formatDate(assignment.startDate)}
                    </p>
                  </div>
                  <span className="badge bg-brand-50 text-brand-700">
                    {assignment.doneCount} / {assignment.totalCount} erledigt
                  </span>
                </div>

                <div className="mt-4">
                  <ProgressBar value={assignment.doneCount} max={assignment.totalCount} />
                </div>

                <div className="mt-4">
                  <OnboardingChecklist items={assignment.items} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Vorlagen" subtitle="Rollenbasierte Einarbeitungspläne">
        {data.templates.length === 0 ? (
          <EmptyState title="Keine Vorlagen" detail="Die Administration hat noch keine Onboarding-Vorlagen angelegt." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {data.templates.map((template) => (
              <article key={template.id} className="min-w-0 rounded-2xl border border-slate-200 p-5">
                <p className="font-semibold text-slate-900">{template.name}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {template.targetRole} · {template.durationLabel}
                </p>
                <ol className="mt-4 space-y-2 text-sm text-slate-700">
                  {template.steps.map((step) => (
                    <li key={step.id} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" />
                      <span className="min-w-0">
                        {/* Das Leerzeichen ist die Umbruchstelle - ohne es steht
                            Schritt und Zuständigkeit als ein Wort und schiebt
                            die Karte bei großer Schrift über den Rand. */}
                        {step.title}{" "}
                        <span className="text-xs text-slate-500">
                          {step.ownerRole}
                          {!step.required ? " · optional" : ""}
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
                <div className="mt-4">
                  <Tag>{template.assignmentCount} Zuweisungen</Tag>
                </div>
              </article>
            ))}
          </div>
        )}
      </Section>
    </AppShell>
  );
}
