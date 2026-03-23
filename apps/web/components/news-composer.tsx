"use client";

import { useMemo, useState } from "react";

const audienceOptions = ["global", "Berlin Mitte", "Hamburg Nord", "Service", "Verkauf", "Kundendienst"];

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function NewsComposer() {
  const [title, setTitle] = useState("");
  const [teaser, setTeaser] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState("normal");
  const [status, setStatus] = useState("draft");
  const [selectedAudiences, setSelectedAudiences] = useState<string[]>(["global"]);
  const [submitted, setSubmitted] = useState(false);

  const slug = useMemo(() => slugify(title), [title]);

  function toggleAudience(audience: string) {
    setSelectedAudiences((current) =>
      current.includes(audience) ? current.filter((entry) => entry !== audience) : [...current, audience],
    );
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <div className="space-y-5">
      <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
        <label className="text-sm font-medium text-slate-700 md:col-span-2">
          Titel
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Titel" className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" />
        </label>
        <label className="text-sm font-medium text-slate-700 md:col-span-2">
          Slug
          <input value={slug} readOnly className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-500" />
        </label>
        <label className="text-sm font-medium text-slate-700 md:col-span-2">
          Teaser
          <textarea value={teaser} onChange={(event) => setTeaser(event.target.value)} placeholder="Kurze Einleitung" className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" rows={2} />
        </label>
        <label className="text-sm font-medium text-slate-700 md:col-span-2">
          Inhalt
          <textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="Ausführlicher Inhalt" className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" rows={6} />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Priorität
          <select value={priority} onChange={(event) => setPriority(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3">
            <option value="niedrig">niedrig</option>
            <option value="normal">normal</option>
            <option value="hoch">hoch</option>
            <option value="kritisch">kritisch</option>
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Status
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3">
            <option value="draft">draft</option>
            <option value="published">published</option>
            <option value="archived">archived</option>
          </select>
        </label>
        <div className="md:col-span-2">
          <p className="text-sm font-medium text-slate-700">Zielgruppen</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {audienceOptions.map((audience) => {
              const active = selectedAudiences.includes(audience);
              return (
                <button
                  key={audience}
                  type="button"
                  onClick={() => toggleAudience(audience)}
                  className={`rounded-full px-4 py-2 text-sm font-medium ${active ? "bg-brand-600 text-white" : "border border-slate-200 bg-white text-slate-700"}`}
                >
                  {audience}
                </button>
              );
            })}
          </div>
        </div>
        <div className="md:col-span-2 flex justify-end">
          <button type="submit" className="rounded-2xl bg-brand-600 px-5 py-3 font-semibold text-white">News vorbereiten</button>
        </div>
      </form>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="font-semibold text-slate-900">Vorschau</p>
        <div className="mt-3 space-y-3 text-sm text-slate-700">
          <p><span className="font-semibold text-slate-900">Titel:</span> {title || "—"}</p>
          <p><span className="font-semibold text-slate-900">Slug:</span> {slug || "—"}</p>
          <p><span className="font-semibold text-slate-900">Priorität:</span> {priority}</p>
          <p><span className="font-semibold text-slate-900">Status:</span> {status}</p>
          <p><span className="font-semibold text-slate-900">Zielgruppen:</span> {selectedAudiences.join(", ")}</p>
        </div>
      </div>

      {submitted ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          News-Konfiguration erfolgreich vorbereitet. Im echten Backend könnte sie nun gespeichert oder veröffentlicht werden.
        </div>
      ) : null}
    </div>
  );
}
