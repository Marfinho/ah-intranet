import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md rounded-3xl bg-white p-8 text-center shadow-card">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-600">Fehler 404</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Seite nicht gefunden</h1>
        <p className="mt-2 text-sm text-slate-600">
          Die aufgerufene Seite existiert nicht, wurde verschoben oder das zugehörige Modul ist deaktiviert.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Zum Dashboard
        </Link>
      </div>
    </div>
  );
}
