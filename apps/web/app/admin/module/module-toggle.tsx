"use client";

import { useTransition } from "react";
import { Lock } from "lucide-react";
import type { ModuleState } from "@ah-intranet/shared";
import { setModuleEnabledAction } from "@/lib/actions";
import { cn, formatDateTime } from "@/lib/utils";

/**
 * Ein Schalter pro Modul. Die Folgen einer Abschaltung (abhängige Module)
 * werden vorher benannt, damit niemand versehentlich halbe Prozesse kappt.
 */
export function ModuleToggle({ module, allModules }: { module: ModuleState; allModules: ModuleState[] }) {
  const [pending, startTransition] = useTransition();

  const labelOf = (key: string) => allModules.find((entry) => entry.key === key)?.label ?? key;
  const dependencyLabels = module.dependsOn.map(labelOf);
  const blockedLabels = module.blocks.map(labelOf);

  function toggle(next: boolean) {
    if (!next && blockedLabels.length > 0) {
      const confirmed = window.confirm(
        `„${module.label}" abschalten?\n\nFolgende abhängige Module werden mit deaktiviert:\n· ${blockedLabels.join("\n· ")}`,
      );
      if (!confirmed) {
        return;
      }
    }

    startTransition(async () => {
      const result = await setModuleEnabledAction(module.key, next);
      if (!result.ok && result.message) {
        window.alert(result.message);
      }
    });
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-2xl border p-5 transition md:flex-row md:items-center md:justify-between",
        module.enabled ? "border-slate-200" : "border-slate-200 bg-slate-50",
        pending && "opacity-70",
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className={cn("font-semibold", module.enabled ? "text-slate-900" : "text-slate-500")}>{module.label}</p>
          {module.core ? (
            <span className="badge inline-flex items-center gap-1 bg-slate-200 text-slate-700">
              <Lock className="h-3 w-3" />
              Kernmodul
            </span>
          ) : null}
          {!module.enabled ? <span className="badge bg-rose-100 text-rose-800">deaktiviert</span> : null}
        </div>

        <p className="mt-1 text-sm text-slate-600">{module.description}</p>

        <p className="mt-2 text-xs text-slate-500">
          Route {module.href}
          {dependencyLabels.length > 0 ? ` · benötigt ${dependencyLabels.join(", ")}` : ""}
          {blockedLabels.length > 0 ? ` · steuert ${blockedLabels.join(", ")}` : ""}
        </p>

        {module.updatedBy ? (
          <p className="mt-1 text-xs text-slate-400">
            Zuletzt geändert von {module.updatedBy}
            {module.updatedAt ? ` am ${formatDateTime(module.updatedAt)}` : ""}
          </p>
        ) : null}
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={module.enabled}
        aria-label={`${module.label} ${module.enabled ? "deaktivieren" : "aktivieren"}`}
        disabled={module.core || pending}
        onClick={() => toggle(!module.enabled)}
        className={cn(
          "relative h-8 w-14 shrink-0 rounded-full transition",
          module.enabled ? "bg-brand-600" : "bg-slate-300",
          (module.core || pending) && "cursor-not-allowed opacity-60",
        )}
      >
        <span
          className={cn(
            "absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all",
            module.enabled ? "left-7" : "left-1",
          )}
        />
      </button>
    </div>
  );
}
