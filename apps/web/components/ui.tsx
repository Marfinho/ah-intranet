import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Section({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="card p-5 lg:p-6">
      <div className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="section-title">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: "bg-slate-100 text-slate-700",
    submitted: "bg-amber-100 text-amber-800",
    approved: "bg-emerald-100 text-emerald-800",
    rejected: "bg-rose-100 text-rose-800",
    queued_for_bulk_order: "bg-sky-100 text-sky-800",
    ordered: "bg-indigo-100 text-indigo-800",
    completed: "bg-emerald-50 text-emerald-700",
    cancelled: "bg-slate-200 text-slate-700",
    published: "bg-emerald-100 text-emerald-800",
    archived: "bg-slate-100 text-slate-700",
  };

  const labels: Record<string, string> = {
    draft: "Entwurf",
    submitted: "Eingereicht",
    approved: "Genehmigt",
    rejected: "Abgelehnt",
    queued_for_bulk_order: "Für Sammelbestellung vorgemerkt",
    ordered: "Extern bestellt",
    completed: "Abgeschlossen",
    cancelled: "Storniert",
    published: "Veröffentlicht",
    archived: "Archiviert",
  };

  return <span className={cn("badge", styles[status] ?? "bg-slate-100 text-slate-700")}>{labels[status] ?? status}</span>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    niedrig: "bg-slate-100 text-slate-700",
    normal: "bg-brand-50 text-brand-700",
    hoch: "bg-amber-100 text-amber-800",
    kritisch: "bg-rose-100 text-rose-800",
  };

  return <span className={cn("badge", styles[priority] ?? "bg-slate-100 text-slate-700")}>{priority}</span>;
}

export function DataGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{children}</div>;
}

export function MetricCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
      <p className="mt-2 text-sm text-slate-600">{helper}</p>
    </div>
  );
}

export function InfoList({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="grid gap-4 md:grid-cols-2">
      {items.map((item) => (
        <div key={String(item.label)} className="rounded-2xl border border-slate-200 p-4">
          <dt className="text-sm text-slate-500">{item.label}</dt>
          <dd className="mt-1 font-medium text-slate-900">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <p className="font-semibold text-slate-900">{title}</p>
      <p className="mt-2 text-sm text-slate-600">{detail}</p>
    </div>
  );
}
