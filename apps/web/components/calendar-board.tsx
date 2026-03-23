import type { CalendarEvent } from "@ah-intranet/shared";
import { formatDate } from "@/lib/utils";

export function CalendarBoard({ events }: { events: CalendarEvent[] }) {
  return (
    <div className="space-y-4">
      {events.map((event) => (
        <div key={event.id} className="rounded-2xl border border-slate-200 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-lg font-semibold text-slate-900">{event.title}</p>
              <p className="text-sm text-slate-600">{event.description}</p>
            </div>
            <span className="badge bg-slate-100 text-slate-700">{event.category}</span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3 text-sm text-slate-700">
            <p><span className="font-semibold text-slate-900">Start:</span> {formatDate(event.startsAt)}</p>
            <p><span className="font-semibold text-slate-900">Ende:</span> {formatDate(event.endsAt)}</p>
            <p><span className="font-semibold text-slate-900">Ort:</span> {event.location}</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {event.audience.map((audience) => (
              <span key={audience} className="badge bg-brand-50 text-brand-700">{audience}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
