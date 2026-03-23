"use client";

import { useMemo, useState } from "react";
import type { OrderStatus } from "@ah-intranet/shared";
import { orderStatusOptions } from "@ah-intranet/shared";
import { DataTable } from "@/components/data-table";
import { FilterToolbar } from "@/components/filter-toolbar";
import { StatusBadge } from "@/components/ui";
import { formatDate } from "@/lib/utils";

type OrderRow = {
  id: string;
  employee: string;
  status: OrderStatus;
  createdAt: string;
  nextCycle: string;
};

export function OrdersTableClient({ rows, compact = false }: { rows: OrderRow[]; compact?: boolean }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesSearch = !query || [row.id, row.employee, row.status].join(" ").toLowerCase().includes(query);
      const matchesStatus = status === "all" || row.status === status;
      return matchesSearch && matchesStatus;
    });
  }, [rows, search, status]);

  return (
    <div className="space-y-4">
      <FilterToolbar
        search={search}
        onSearchChange={setSearch}
        status={status}
        onStatusChange={setStatus}
        statuses={[...orderStatusOptions]}
        searchPlaceholder="Nach Bestellnummer, Mitarbeiter oder Status suchen"
      />
      <DataTable
        rows={filtered}
        columns={[
          { key: "id", header: "Bestellung", render: (order) => <span className="font-semibold text-slate-900">{order.id}</span> },
          { key: "employee", header: "Mitarbeiter", render: (order) => order.employee },
          { key: "created", header: "Eingang", render: (order) => formatDate(order.createdAt) },
          { key: "status", header: "Status", render: (order) => <StatusBadge status={order.status} /> },
          ...(compact
            ? []
            : [
                {
                  key: "cycle",
                  header: "Sammelbestellung",
                  render: (order: OrderRow) => formatDate(order.nextCycle),
                },
              ]),
        ]}
      />
    </div>
  );
}
