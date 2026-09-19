"use client";

import { ChevronUp } from "lucide-react";
import { useTransition } from "react";
import type { Idea } from "@ah-intranet/shared";
import { setIdeaStatusAction, voteIdeaAction } from "@/lib/actions";
import { cn } from "@/lib/utils";

/** Zustimmungsknopf plus Statuswahl für den Fachbereich. */
export function IdeaCard({ idea, canManage }: { idea: Idea; canManage: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex shrink-0 flex-row items-center gap-3 md:flex-col md:items-stretch">
      <button
        type="button"
        disabled={pending}
        aria-pressed={idea.votedByMe}
        onClick={() =>
          startTransition(async () => {
            const result = await voteIdeaAction(idea.id);
            if (!result.ok && result.message) {
              window.alert(result.message);
            }
          })
        }
        className={cn(
          "flex w-20 flex-col items-center rounded-2xl border px-3 py-2 transition disabled:opacity-60",
          idea.votedByMe
            ? "border-brand-600 bg-brand-50 text-brand-800"
            : "border-slate-200 text-slate-600 hover:bg-slate-50",
        )}
      >
        <ChevronUp className="h-5 w-5" />
        <span className="text-lg font-bold">{idea.voteCount}</span>
        <span className="text-[10px] uppercase tracking-wide">{idea.votedByMe ? "dafür" : "zustimmen"}</span>
      </button>

      {canManage ? (
        <select
          defaultValue={idea.status}
          disabled={pending}
          aria-label={`Status von ${idea.title}`}
          onChange={(event) => {
            const status = event.target.value;
            startTransition(async () => {
              const result = await setIdeaStatusAction(idea.id, status);
              if (!result.ok && result.message) {
                window.alert(result.message);
              }
            });
          }}
          className="w-36 rounded-xl border border-slate-200 px-2 py-2 text-xs text-slate-800"
        >
          <option value="neu">Neu</option>
          <option value="in_pruefung">In Prüfung</option>
          <option value="angenommen">Angenommen</option>
          <option value="umgesetzt">Umgesetzt</option>
          <option value="abgelehnt">Abgelehnt</option>
        </select>
      ) : null}
    </div>
  );
}
