"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { NewsItem } from "@ah-intranet/shared";
import { FilterToolbar } from "@/components/filter-toolbar";
import { PriorityBadge, StatusBadge } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export function NewsListClient({ items }: { items: NewsItem[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) =>
      [item.title, item.teaser, item.content, item.author, item.audience.join(" ")].join(" ").toLowerCase().includes(query),
    );
  }, [items, search]);

  return (
    <div className="space-y-4">
      <FilterToolbar search={search} onSearchChange={setSearch} searchPlaceholder="News nach Titel, Autor oder Zielgruppe suchen" />
      {filtered.map((news) => (
        <Link key={news.id} href={`/aktuelles/${news.slug}`} className="block rounded-2xl border border-slate-200 p-5 transition hover:border-brand-100 hover:bg-slate-50">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={news.status} />
            <PriorityBadge priority={news.priority} />
            <span className="text-sm text-slate-500">{formatDate(news.publishedAt)}</span>
          </div>
          <h2 className="mt-3 text-xl font-semibold text-slate-900">{news.title}</h2>
          <p className="mt-2 text-slate-600">{news.teaser}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs uppercase tracking-wide text-slate-400">
            {news.audience.map((entry) => (
              <span key={entry} className="badge bg-slate-100 text-slate-700">{entry}</span>
            ))}
          </div>
        </Link>
      ))}
    </div>
  );
}
