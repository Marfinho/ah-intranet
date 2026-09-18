export interface TimelineItem {
  timestamp: string;
  title: string;
  detail: string;
  actor?: string;
}

export function Timeline({ entries }: { entries: TimelineItem[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-slate-600">Noch keine Einträge.</p>;
  }

  return (
    <ol className="relative space-y-5 border-l border-slate-200 pl-6">
      {entries.map((entry, index) => (
        <li key={`${entry.timestamp}-${index}`} className="relative">
          <span className="absolute -left-[31px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-brand-600" />
          <p className="text-sm font-semibold text-slate-900">{entry.title}</p>
          {entry.detail ? <p className="mt-0.5 text-sm text-slate-600">{entry.detail}</p> : null}
          <p className="mt-1 text-xs text-slate-500">
            {entry.timestamp}
            {entry.actor ? ` · ${entry.actor}` : ""}
          </p>
        </li>
      ))}
    </ol>
  );
}
