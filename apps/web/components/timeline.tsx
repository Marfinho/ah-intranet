import type { TimelineEntry } from "@ah-intranet/shared";
import { formatDate } from "@/lib/utils";

export function Timeline({ items }: { items: TimelineEntry[] }) {
  return (
    <div className="space-y-4">
      {items.map((entry) => (
        <div key={`${entry.timestamp}-${entry.title}`} className="relative rounded-2xl border border-slate-200 p-4 pl-6">
          <span className="absolute left-4 top-6 h-2.5 w-2.5 rounded-full bg-brand-600" />
          <p className="text-sm text-slate-500">{formatDate(entry.timestamp)}</p>
          <p className="mt-1 font-semibold text-slate-900">{entry.title}</p>
          <p className="text-sm text-slate-600">{entry.detail}</p>
          {entry.actor ? <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-400">{entry.actor}</p> : null}
        </div>
      ))}
    </div>
  );
}
