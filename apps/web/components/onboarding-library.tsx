import type { OnboardingTemplate } from "@ah-intranet/shared";

export function OnboardingLibrary({ templates }: { templates: OnboardingTemplate[] }) {
  return (
    <div className="space-y-4">
      {templates.map((template) => (
        <div key={template.id} className="rounded-2xl border border-slate-200 p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-lg font-semibold text-slate-900">{template.name}</p>
              <p className="text-sm text-slate-600">Zielrolle: {template.targetRole}</p>
            </div>
            <span className="badge bg-brand-50 text-brand-700">{template.duration}</span>
          </div>
          <div className="mt-4 space-y-3">
            {template.steps.map((step) => (
              <div key={step.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <span className="font-semibold text-slate-900">{step.title}</span> · {step.owner} · {step.required ? "Pflicht" : "Optional"}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
