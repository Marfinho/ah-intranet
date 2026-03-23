import { notFound } from "next/navigation";
import { newsItems } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { InfoList, PriorityBadge, Section, StatusBadge } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export default function NewsDetailPage({ params }: { params: { slug: string } }) {
  const news = newsItems.find((item) => item.slug === params.slug);

  if (!news) {
    notFound();
  }

  return (
    <AppShell title={news.title} subtitle="Detailansicht mit Anhängen, Zielgruppen und Veröffentlichungsinformationen">
      <Section title={news.title} subtitle={news.teaser}>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={news.status} />
          <PriorityBadge priority={news.priority} />
          <span className="text-sm text-slate-500">Veröffentlicht: {formatDate(news.publishedAt)}</span>
        </div>
        <p className="mt-6 whitespace-pre-line text-slate-700">{news.content}</p>
        <div className="mt-6">
          <InfoList
            items={[
              { label: "Autor", value: news.author },
              { label: "Zielgruppen", value: news.audience.join(", ") },
              { label: "Ablaufzeit", value: news.expiresAt ? formatDate(news.expiresAt) : "Keine Ablaufzeit" },
              { label: "Benachrichtigung", value: "In-App, optional per E-Mail falls vorhanden" },
              { label: "Anhänge", value: news.attachments.length ? `${news.attachments.length} Datei(en)` : "Keine Anhänge" },
            ]}
          />
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {news.attachments.map((attachment) => (
            <div key={attachment.name} className="rounded-2xl border border-slate-200 p-4">
              <p className="font-semibold text-slate-900">{attachment.name}</p>
              <p className="text-sm text-slate-600">Typ: {attachment.type}</p>
              <p className="mt-2 text-xs uppercase tracking-wide text-slate-400">Download vorbereitet</p>
            </div>
          ))}
        </div>
      </Section>
    </AppShell>
  );
}
