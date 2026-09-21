"use client";

import { useTransition } from "react";
import type { OnboardingAssignment } from "@ah-intranet/shared";
import { toggleOnboardingItemAction } from "@/lib/actions";
import { cn, formatDate } from "@/lib/utils";

export function OnboardingChecklist({ items }: { items: OnboardingAssignment["items"] }) {
  const [pending, startTransition] = useTransition();

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id}>
          <label
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition",
              item.done ? "border-emerald-200 bg-emerald-50" : "border-slate-200 hover:bg-slate-50",
              pending && "opacity-70",
            )}
          >
            <input
              type="checkbox"
              checked={item.done}
              disabled={pending}
              onChange={(event) => {
                const done = event.target.checked;
                startTransition(async () => {
                  const result = await toggleOnboardingItemAction(item.id, done);
                  if (!result.ok && result.message) {
                    window.alert(result.message);
                  }
                });
              }}
              className="mt-0.5 h-5 w-5"
            />
            <span className="min-w-0">
              <span className={cn("font-medium", item.done ? "text-emerald-900 line-through" : "text-slate-800")}>
                {item.title}
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
                {item.ownerRole}
                {!item.required ? " · optional" : ""}
                {item.done && item.doneAt ? ` · erledigt ${formatDate(item.doneAt)}` : ""}
              </span>
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}
