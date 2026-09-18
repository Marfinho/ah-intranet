import Link from "next/link";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Section({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
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

const STATUS_STYLES: Record<string, string> = {
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
  offen: "bg-amber-100 text-amber-800",
  in_bearbeitung: "bg-sky-100 text-sky-800",
  wartet_auf_rueckmeldung: "bg-violet-100 text-violet-800",
  geloest: "bg-emerald-100 text-emerald-800",
  neu: "bg-sky-100 text-sky-800",
  in_pruefung: "bg-amber-100 text-amber-800",
  angenommen: "bg-emerald-100 text-emerald-800",
  umgesetzt: "bg-emerald-50 text-emerald-700",
  abgelehnt: "bg-rose-100 text-rose-800",
  reserviert: "bg-sky-100 text-sky-800",
  abgeholt: "bg-amber-100 text-amber-800",
  zurueckgegeben: "bg-emerald-100 text-emerald-800",
  storniert: "bg-slate-200 text-slate-700",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Entwurf",
  submitted: "Eingereicht",
  approved: "Genehmigt",
  rejected: "Abgelehnt",
  queued_for_bulk_order: "Für Sammelbestellung",
  ordered: "Extern bestellt",
  completed: "Abgeschlossen",
  cancelled: "Storniert",
  published: "Veröffentlicht",
  archived: "Archiviert",
  offen: "Offen",
  in_bearbeitung: "In Bearbeitung",
  wartet_auf_rueckmeldung: "Wartet auf Rückmeldung",
  geloest: "Gelöst",
  neu: "Neu",
  in_pruefung: "In Prüfung",
  angenommen: "Angenommen",
  umgesetzt: "Umgesetzt",
  abgelehnt: "Abgelehnt",
  reserviert: "Reserviert",
  abgeholt: "Abgeholt",
  zurueckgegeben: "Zurückgegeben",
  storniert: "Storniert",
  urlaub: "Urlaub",
  krank: "Krankmeldung",
  gleitzeit: "Gleitzeit",
  sonderurlaub: "Sonderurlaub",
  fortbildung: "Fortbildung",
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("badge", STATUS_STYLES[status] ?? "bg-slate-100 text-slate-700")}>
      {statusLabel(status)}
    </span>
  );
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

export function Tag({ children }: { children: ReactNode }) {
  return <span className="badge bg-slate-100 text-slate-600">{children}</span>;
}

export function DataGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{children}</div>;
}

export function MetricCard({ label, value, helper, href }: { label: string; value: string; helper: string; href?: string }) {
  const content = (
    <>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
      <p className="mt-2 text-sm text-slate-600">{helper}</p>
    </>
  );

  const className = "block rounded-2xl border border-slate-200 bg-slate-50 p-4 transition";

  return href ? (
    <Link href={href} className={cn(className, "hover:border-brand-100 hover:bg-white hover:shadow-card")}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
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

export function ProgressBar({ value, max }: { value: number; max: number }) {
  const percent = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${percent}%` }} />
      </div>
      <span className="shrink-0 text-xs font-semibold text-slate-600">{percent}%</span>
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-2xl border border-slate-200 p-5", className)}>{children}</div>;
}
