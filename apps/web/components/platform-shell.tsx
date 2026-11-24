import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { logoutAction } from "@/lib/actions";
import { requireSession } from "@/lib/session";

const NAV = [
  { href: "/plattform", label: "Autohäuser" },
  { href: "/plattform/status", label: "Systemstatus" },
];

/**
 * Eigener Rahmen für die Plattformverwaltung - bewusst ohne `AppShell`.
 *
 * `AppShell` baut ihre Navigation aus der Modul-Registry des Mandanten auf;
 * der Betreiber-Mandant hat aber keine Fachmodule und keine Geschäftsdaten.
 * Das Ergebnis wäre kein reduziertes Intranet, sondern eine kaputte Attrappe
 * davon - eine Kachel "Mein Profil" neben einer leeren Modulliste. Wer Häuser
 * verwaltet, braucht kein Intranet, sondern ein Werkzeug für genau das.
 */
export async function PlatformShell({
  children,
  title,
  subtitle,
}: {
  children: ReactNode;
  title: string;
  subtitle: string;
}) {
  const session = await requireSession();
  if (!session.isPlatformAdmin) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-800 bg-slate-900">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <Logo signetClass="h-6 w-6" className="text-white" />
            <span className="hidden text-sm font-semibold uppercase tracking-[0.14em] text-slate-400 sm:inline">
              Plattformverwaltung
            </span>
          </div>

          <nav className="flex items-center gap-1 text-sm font-medium">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2 text-slate-300 transition hover:bg-slate-800 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-300 sm:inline">{session.displayName}</span>
            <form action={logoutAction}>
              <button
                type="submit"
                aria-label="Abmelden"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800 hover:text-white"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 lg:px-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
        </div>
        {children}
      </main>
    </div>
  );
}
