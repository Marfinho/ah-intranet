import Link from "next/link";
import { Bell, LogOut, UserCircle2 } from "lucide-react";
import type { ReactNode } from "react";
import { MODULE_GROUP_LABELS, type ModuleGroup } from "@ah-intranet/shared";
import { getModules, getUnreadCount, requireSession } from "@/lib/session";
import { FeedbackButton } from "@/components/feedback-button";
import { Logo } from "@/components/logo";
import { logoutAction } from "@/lib/actions";
import { SideNav, type NavGroup } from "./side-nav";
import { SearchBox } from "./search-box";

/**
 * Rahmen für alle angemeldeten Seiten. Die Navigation entsteht aus der
 * Modul-Registry: abgeschaltete Module verschwinden hier automatisch.
 */
export async function AppShell({
  children,
  title,
  subtitle,
}: {
  children: ReactNode;
  title: string;
  subtitle: string;
}) {
  const [session, modules, unread] = await Promise.all([requireSession(), getModules(), getUnreadCount()]);

  const visible = modules.filter((module) => {
    if (!module.enabled) return false;
    // Verwaltungsmodule nur für die passenden Rollen einblenden.
    if (module.key === "admin") return session.roles.includes("admin") || session.roles.includes("fachbereichsadmin");
    if (module.key === "audit") return session.roles.includes("admin");
    if (module.key === "approvals")
      return session.roles.includes("admin") || session.roles.includes("fachbereichsadmin");
    return true;
  });

  // Trägt dieses Haus eine Erprobung? Dann braucht es einen Rückkanal.
  const inErprobung = modules.some((module) => module.stage === "beta" && module.enabled);

  const groups: NavGroup[] = (Object.keys(MODULE_GROUP_LABELS) as ModuleGroup[])
    .map((group) => ({
      label: MODULE_GROUP_LABELS[group],
      items: visible
        .filter((module) => module.group === group)
        .map((module) => ({
          href: module.href,
          label: module.label,
          icon: module.icon,
          beta: module.stage === "beta",
        })),
    }))
    .filter((group) => group.items.length > 0);

  groups.push({
    label: "Persönlich",
    items: [{ href: "/profil", label: "Mein Profil", icon: "UserCircle2" }],
  });

  const searchEnabled = visible.some((module) => module.key === "search");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 lg:px-8 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <Logo signetClass="h-6 w-6" className="text-slate-900" />
              <span className="truncate text-sm font-semibold text-slate-500">{session.tenant.name}</span>
            </div>
            <h1 className="truncate text-xl font-bold text-slate-900">{title}</h1>
            <p className="text-sm text-slate-600">{subtitle}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {searchEnabled ? <SearchBox /> : null}

            {/* Nur bei laufender Erprobung: sonst ist der Knopf Beiwerk. */}
            {inErprobung ? <FeedbackButton /> : null}

            <Link
              href="/benachrichtigungen"
              aria-label={`Benachrichtigungen, ${unread} ungelesen`}
              className="relative rounded-full border border-slate-200 bg-white p-3 text-slate-600 transition hover:border-brand-100 hover:text-brand-700"
            >
              <Bell className="h-5 w-5" />
              {unread > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : null}
            </Link>

            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2">
              <UserCircle2 className="h-8 w-8 text-slate-400" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{session.displayName}</p>
                <p className="truncate text-xs text-slate-500">{session.jobTitle}</p>
              </div>
              <form action={logoutAction}>
                <button
                  type="submit"
                  aria-label="Abmelden"
                  className="rounded-lg p-2 text-slate-500 transition hover:bg-white hover:text-rose-600"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-8">
        <aside className="card h-fit p-3 lg:sticky lg:top-6">
          <SideNav groups={groups} />
        </aside>
        <main className="min-w-0 space-y-6">{children}</main>
      </div>
    </div>
  );
}
