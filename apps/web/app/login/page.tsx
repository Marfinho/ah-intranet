import { users } from "@ah-intranet/shared";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-card lg:grid-cols-[1.1fr_0.9fr]">
        <section className="bg-gradient-to-br from-brand-900 via-brand-700 to-brand-600 p-8 text-white lg:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-100">Autohaus Intranet</p>
          <h1 className="mt-4 text-4xl font-bold">Intern arbeiten. Klar. Sicher. Zentral.</h1>
          <p className="mt-4 text-sm text-brand-50">
            Das Portal bündelt interne News, Bestellprozesse für Visitenkarten und Arbeitskleidung, Freigaben und Administration in einer responsiven deutschen Oberfläche.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-brand-50">
            <li>• Lokaler Login mit Benutzername und Passwort</li>
            <li>• E-Mail optional, auch für Mitarbeitende ohne Firmenpostfach</li>
            <li>• Vorbereitete Standort-, Abteilungs- und Scope-Logik</li>
          </ul>
        </section>
        <section className="p-8 lg:p-10">
          <h2 className="text-3xl font-bold text-slate-900">Anmeldung</h2>
          <p className="mt-2 text-sm text-slate-600">Bitte melden Sie sich mit Ihrem Benutzernamen und Passwort an.</p>
          <form className="mt-8 space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              Benutzername
              <input className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-brand-600 transition focus:ring-2" defaultValue="service.mitte" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Passwort
              <input type="password" className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-brand-600 transition focus:ring-2" defaultValue="Start123!" />
            </label>
            <button type="submit" className="w-full rounded-2xl bg-brand-600 px-4 py-3 font-semibold text-white transition hover:bg-brand-700">Anmelden</button>
          </form>
          <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">Demo-Zugänge</p>
            <ul className="mt-2 space-y-1">
              {users.slice(0, 3).map((user) => (
                <li key={user.username}>{user.username} / Start123!</li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}
