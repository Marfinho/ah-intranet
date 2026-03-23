"use client";

import { useMemo, useState } from "react";
import type { EmployeeDirectoryEntry } from "@ah-intranet/shared";
import { FilterToolbar } from "@/components/filter-toolbar";

export function EmployeeDirectoryClient({ entries }: { entries: EmployeeDirectoryEntry[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return entries;
    return entries.filter((entry) =>
      [
        entry.displayName,
        entry.title,
        entry.location,
        entry.department,
        entry.specialtyArea ?? "",
        entry.responsibilities.join(" "),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [entries, search]);

  return (
    <div className="space-y-4">
      <FilterToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Name, Standort, Abteilung oder Zuständigkeit suchen" />
      <div className="grid gap-4 lg:grid-cols-2">
        {filtered.map((entry) => (
          <div key={entry.id} className="rounded-2xl border border-slate-200 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-slate-900">{entry.displayName}</p>
                <p className="text-sm text-slate-600">{entry.title}</p>
              </div>
              <span className="badge bg-slate-100 text-slate-700">{entry.presence}</span>
            </div>
            <div className="mt-4 space-y-1 text-sm text-slate-700">
              <p>{entry.location} · {entry.department}</p>
              {entry.specialtyArea ? <p>{entry.specialtyArea}</p> : null}
              <p>Telefon: {entry.phone}</p>
              {entry.mobile ? <p>Mobil: {entry.mobile}</p> : null}
              {entry.email ? <p>E-Mail: {entry.email}</p> : null}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {entry.responsibilities.map((item) => (
                <span key={item} className="badge bg-brand-50 text-brand-700">{item}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
