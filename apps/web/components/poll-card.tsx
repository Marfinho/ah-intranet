"use client";

import { useTransition } from "react";
import type { Poll } from "@ah-intranet/shared";
import { closePollAction, votePollAction } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";

export function PollCard({ poll, canManage }: { poll: Poll; canManage: boolean }) {
  const [pending, startTransition] = useTransition();
  const closed = !poll.isActive;

  return (
    <div className="rounded-2xl border border-slate-200 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900">{poll.question}</p>
          {poll.description ? <p className="mt-1 text-sm text-slate-600">{poll.description}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          <span className="badge bg-slate-100 text-slate-600">{poll.totalVotes} Stimmen</span>
          {closed ? <span className="badge bg-slate-200 text-slate-700">beendet</span> : null}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {poll.options.map((option) => {
          const percent = poll.totalVotes === 0 ? 0 : Math.round((option.votes / poll.totalVotes) * 100);
          const mine = poll.myOptionId === option.id;

          return (
            <button
              key={option.id}
              type="button"
              disabled={closed || pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await votePollAction(poll.id, option.id);
                  if (!result.ok && result.message) {
                    window.alert(result.message);
                  }
                })
              }
              className={cn(
                "relative w-full overflow-hidden rounded-xl border px-4 py-3 text-left text-sm transition",
                mine ? "border-brand-600 bg-brand-50" : "border-slate-200 hover:border-brand-100",
                (closed || pending) && "cursor-not-allowed opacity-80",
              )}
            >
              <span
                className={cn("absolute inset-y-0 left-0 transition-all", mine ? "bg-brand-100" : "bg-slate-100")}
                style={{ width: `${percent}%` }}
                aria-hidden
              />
              <span className="relative flex items-center justify-between gap-3">
                <span className={cn("font-medium", mine ? "text-brand-800" : "text-slate-700")}>
                  {option.label}
                  {mine ? " ✓" : ""}
                </span>
                <span className="shrink-0 text-xs font-semibold text-slate-600">
                  {option.votes} · {percent}%
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>{poll.closesAt ? `Läuft bis ${formatDate(poll.closesAt)}` : "Ohne Enddatum"}</span>
        {canManage && !closed ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => closePollAction(poll.id).then(() => undefined))}
            className="font-semibold text-rose-600 hover:underline"
          >
            Umfrage schließen
          </button>
        ) : null}
      </div>
    </div>
  );
}
