"use client";

import { useMemo, useState } from "react";
import type { ApprovalTask } from "@ah-intranet/shared";
import { orderStatusOptions } from "@ah-intranet/shared";
import { FilterToolbar } from "@/components/filter-toolbar";
import { StatusBadge } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export function ApprovalsBoard({ tasks }: { tasks: ApprovalTask[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tasks.filter((task) => {
      const matchesSearch = !query || [task.orderId, task.requester, task.scope, task.nextAction].join(" ").toLowerCase().includes(query);
      const matchesStatus = status === "all" || task.status === status;
      return matchesSearch && matchesStatus;
    });
  }, [tasks, search, status]);

  return (
    <div className="space-y-4">
      <FilterToolbar
        search={search}
        onSearchChange={setSearch}
        status={status}
        onStatusChange={setStatus}
        statuses={[...orderStatusOptions]}
        searchPlaceholder="Freigaben nach Bestellnummer, Scope oder Person suchen"
      />
      <div className="space-y-4">
        {filtered.map((task) => (
          <div key={task.id} className="rounded-2xl border border-slate-200 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold text-slate-900">{task.orderId}</p>
                <p className="text-sm text-slate-600">{task.requester} · {task.scope} · {formatDate(task.createdAt)}</p>
              </div>
              <StatusBadge status={task.status} />
            </div>
            <p className="mt-4 text-sm text-slate-700">{task.nextAction}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Genehmigen</button>
              <button className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white">Ablehnen</button>
              <button className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Als extern bestellt markieren</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
