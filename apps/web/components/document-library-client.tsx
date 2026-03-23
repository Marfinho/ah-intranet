"use client";

import { useMemo, useState } from "react";
import type { DocumentItem } from "@ah-intranet/shared";
import { documentCategories } from "@ah-intranet/shared";
import { FilterToolbar } from "@/components/filter-toolbar";
import { formatDate } from "@/lib/utils";

export function DocumentLibraryClient({ documents }: { documents: DocumentItem[] }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return documents.filter((doc) => {
      const matchesSearch = !query || [doc.title, doc.description, doc.owner, doc.audience.join(" ")].join(" ").toLowerCase().includes(query);
      const matchesCategory = category === "all" || doc.category === category;
      return matchesSearch && matchesCategory;
    });
  }, [documents, search, category]);

  return (
    <div className="space-y-4">
      <FilterToolbar
        search={search}
        onSearchChange={setSearch}
        status={category}
        onStatusChange={setCategory}
        statuses={documentCategories}
        searchPlaceholder="Dokumente, Vorlagen oder Kategorien suchen"
      />
      <div className="space-y-4">
        {filtered.map((doc) => (
          <div key={doc.id} className="rounded-2xl border border-slate-200 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-lg font-semibold text-slate-900">{doc.title}</p>
                <p className="text-sm text-slate-600">{doc.description}</p>
              </div>
              <span className="badge bg-slate-100 text-slate-700">{doc.fileType}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-600">
              <span>{doc.category}</span>
              <span>•</span>
              <span>{doc.owner}</span>
              <span>•</span>
              <span>{formatDate(doc.updatedAt)}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {doc.audience.map((item) => (
                <span key={item} className="badge bg-brand-50 text-brand-700">{item}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
