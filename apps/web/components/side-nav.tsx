"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  CalendarOff,
  Car,
  CarFront,
  ClipboardList,
  DoorOpen,
  GraduationCap,
  LayoutDashboard,
  Library,
  Lightbulb,
  LifeBuoy,
  Link2,
  Newspaper,
  PlugZap,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  UserCircle2,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Nur die in der Registry verwendeten Icons - kein dynamischer Import nötig. */
const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  Search,
  Bell,
  Link2,
  Newspaper,
  Users,
  BarChart3,
  Lightbulb,
  BookOpen,
  Library,
  ClipboardList,
  ShieldCheck,
  LifeBuoy,
  GraduationCap,
  CalendarOff,
  CalendarDays,
  DoorOpen,
  Car,
  CarFront,
  PlugZap,
  Settings,
  ScrollText,
  UserCircle2,
};

export interface NavGroup {
  label: string;
  items: { href: string; label: string; icon: string }[];
}

export function SideNav({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-4">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="px-4 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{group.label}</p>
          <div className="space-y-1">
            {group.items.map((item) => {
              const Icon = ICONS[item.icon] ?? LayoutDashboard;
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition",
                    active ? "bg-brand-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
