"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

export interface FilterSelect {
  name: string;
  label: string;
  options: { value: string; label: string }[];
}

/**
 * Filter laufen über die URL, nicht über lokalen State: die Einschränkung
 * passiert damit in der Datenbank statt im Browser, und Treffer sind teilbar
 * und per Zurück-Taste erreichbar.
 */
export function FilterBar({
  selects = [],
  searchPlaceholder = "Suchen",
  showSearch = true,
}: {
  selects?: FilterSelect[];
  searchPlaceholder?: string;
  showSearch?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(params.get("search") ?? "");

  useEffect(() => {
    setSearch(params.get("search") ?? "");
  }, [params]);

  function apply(next: Record<string, string>) {
    const query = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value || value === "all") {
        query.delete(key);
      } else {
        query.set(key, value);
      }
    }
    startTransition(() => router.replace(`${pathname}?${query.toString()}`, { scroll: false }));
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        apply({ search });
      }}
      className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center"
    >
      {showSearch ? (
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onBlur={() => apply({ search })}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-brand-600 focus:ring-2"
        />
      ) : null}

      {selects.map((select) => (
        <select
          key={select.name}
          aria-label={select.label}
          defaultValue={params.get(select.name) ?? "all"}
          onChange={(event) => apply({ [select.name]: event.target.value })}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-brand-600 focus:ring-2 md:min-w-52"
        >
          <option value="all">{select.label}</option>
          {select.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ))}

      <button type="submit" className="hidden" aria-hidden>
        Filtern
      </button>
      {pending ? <span className="text-xs text-slate-500">aktualisiert …</span> : null}
    </form>
  );
}
