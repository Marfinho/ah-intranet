import Link from "next/link";

const MODULE_BEISPIELE = [
  { titel: "Aktuelles & Wissen", text: "News, Wiki und Dokumente je Zielgruppe - Standort, Abteilung oder alle." },
  { titel: "Bestellungen & Freigaben", text: "Arbeitskleidung, Visitenkarten und Sammelbestellungen mit Freigabeweg." },
  { titel: "Serviceanfragen", text: "Tickets, Umfragen, Ideen - der interne Anlaufpunkt statt loser E-Mails." },
  {
    titel: "Schichtplan & Diensttausch",
    text: "Mit beidseitiger Zustimmung, damit keine Schicht einseitig verschoben wird.",
  },
];

/**
 * Öffentliche Produktseite auf der Adresse des Betreibers (`ahoi.online`).
 *
 * Erscheint nur, wenn keine Subdomain und keine eigene Kundendomain erkannt
 * wurde (siehe `middleware.ts`) - jedes Haus landet weiterhin direkt bei
 * seinem eigenen Anmeldeformular. Bewusst ohne Sitzung und ohne `AppShell`:
 * diese Seite braucht keinen Mandantenkontext.
 */
export default function StartPage() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-8">
        <span className="font-display text-lg font-bold tracking-tight">AHOI</span>
        <Link
          href="/login"
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Anmelden
        </Link>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-16 pt-8">
        <p className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-600">
          Autohaus Organisation & Information
        </p>
        <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
          Das Intranet für den Betriebsalltag mehrerer Autohäuser.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-slate-600">
          Aushänge, Bestellungen, Freigaben, Anträge, Serviceanfragen, Einarbeitung - für jedes Haus Ihrer Gruppe unter
          seiner eigenen Adresse, zentral eingerichtet und lizenziert. Nicht das Autogeschäft selbst - dafür haben Sie
          bereits Ihr DMS.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/login"
            className="rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Zur Anmeldung Ihres Hauses
          </Link>
        </div>
      </section>

      <section className="border-t border-slate-100 bg-slate-50">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 py-16 sm:grid-cols-2">
          {MODULE_BEISPIELE.map((eintrag) => (
            <div key={eintrag.titel} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
              <h2 className="text-base font-semibold text-slate-900">{eintrag.titel}</h2>
              <p className="mt-2 text-sm text-slate-600">{eintrag.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="rounded-3xl bg-slate-900 p-8 text-white sm:p-10">
          <h2 className="text-2xl font-bold">Für Ihre Autohausgruppe eingerichtet</h2>
          <p className="mt-3 max-w-2xl text-sm text-slate-300">
            Jedes Haus Ihrer Gruppe erhält eine eigene Adresse, eigene Rollen und Rechte, und baut Standorte,
            Abteilungen und Mitarbeitende innerhalb der vereinbarten Lizenz selbst auf. Die Einrichtung übernehmen wir -
            sprechen Sie uns an.
          </p>
        </div>
      </section>

      <footer className="border-t border-slate-100 py-8 text-center text-xs text-slate-500">
        AHOI - Autohaus Organisation & Information
      </footer>
    </main>
  );
}
