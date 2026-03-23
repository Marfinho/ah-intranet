"use client";

import Link from "next/link";
import { Bell, BookOpen, CalendarDays, ClipboardList, LayoutDashboard, LifeBuoy, Newspaper, Settings, Shield, UserCircle2, Users } from "lucide-react";
import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { currentUser, unreadNotifications } from "@ah-intranet/shared";
import { cn } from "@/lib/utils";

const primaryNav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/aktuelles", label: "Aktuelles", icon: Newspaper },
  { href: "/mitarbeiter", label: "Mitarbeiter", icon: Users },
  { href: "/dokumente", label: "Dokumente", icon: BookOpen },
  { href: "/kalender", label: "Kalender", icon: CalendarDays },
  { href: "/tickets", label: "Tickets", icon: LifeBuoy },
  { href: "/bestellungen/meine", label: "Meine Bestellungen", icon: ClipboardList },
  { href: "/freigaben", label: "Freigaben", icon: Shield },
  { href: "/onboarding", label: "Onboarding", icon: BookOpen },
];

const secondaryNav = [
  { href: "/benachrichtigungen", label: "Benachrichtigungen", icon: Bell },
  { href: "/admin", label: "Administration", icon: Settings },
  { href: "/profil", label: "Profil", icon: UserCircle2 },
];

export function AppShell({ children, title, subtitle }: { children: ReactNode; title: string; subtitle: string }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 lg:px-8 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-600">Autohaus Intranet</p>
            <h1 className="text-xl font-bold text-slate-900">{title}</h1>
            <p className="text-sm text-slate-600">{subtitle}</p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <Link href="/benachrichtigungen" className="relative rounded-full border border-slate-200 bg-white p-3 text-slate-600 transition hover:border-brand-100 hover:text-brand-700">
              <Bell className="h-5 w-5" />
              {unreadNotifications.length ? <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-rose-500" /> : null}
            </Link>
            <div>
              <p className="text-sm font-semibold text-slate-900">{currentUser.displayName}</p>
              <p className="text-xs text-slate-500">{currentUser.scope} · {unreadNotifications.length} ungelesen</p>
            </div>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:px-8">
        <aside className="card h-fit p-3">
          <nav className="space-y-1">
            <p className="px-4 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Arbeitsbereiche</p>
            {[...primaryNav, ...secondaryNav].map((item) => {
              const Icon = item.icon;
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition",
                    active ? "bg-brand-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="space-y-6">{children}</main>
      </div>
    </div>
  );
}
