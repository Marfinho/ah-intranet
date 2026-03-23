"use client";

interface FilterToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  status?: string;
  onStatusChange?: (value: string) => void;
  statuses?: string[];
  searchPlaceholder?: string;
}

export function FilterToolbar({
  search,
  onSearchChange,
  status,
  onStatusChange,
  statuses,
  searchPlaceholder = "Suchen",
}: FilterToolbarProps) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center">
      <input
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={searchPlaceholder}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-brand-600 focus:ring-2"
      />
      {statuses && onStatusChange ? (
        <select
          value={status ?? "all"}
          onChange={(event) => onStatusChange(event.target.value)}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-brand-600 focus:ring-2 md:min-w-64"
        >
          <option value="all">Alle Status</option>
          {statuses.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}
