"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { NotificationItem } from "@ah-intranet/shared";
import { FilterToolbar } from "@/components/filter-toolbar";
import { formatDate } from "@/lib/utils";

export function NotificationCenterClient({ items }: { items: NotificationItem[] }) {
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState("all");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch = !query || [item.title, item.detail].join(" ").toLowerCase().includes(query);
      const matchesChannel = channel === "all" || item.channel === channel;
      return matchesSearch && matchesChannel;
    });
  }, [items, search, channel]);

  return (
    <div className="space-y-4">
      <FilterToolbar
        search={search}
        onSearchChange={setSearch}
        status={channel}
        onStatusChange={setChannel}
        statuses={["in_app", "email"]}
        searchPlaceholder="Benachrichtigungen durchsuchen"
      />
      <div className="space-y-3">
        {filtered.map((item) => (
          <div key={item.id} className={`rounded-2xl border p-4 ${item.read ? "border-slate-200 bg-white" : "border-brand-200 bg-brand-50/40"}`}>
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <p className="font-semibold text-slate-900">{item.title}</p>
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
                <span>{item.channel}</span>
                <span>{formatDate(item.createdAt)}</span>
              </div>
            </div>
            <p className="mt-2 text-sm text-slate-700">{item.detail}</p>
            {item.link ? <Link href={item.link} className="mt-3 inline-flex text-sm font-semibold text-brand-700">Zum Eintrag</Link> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
