import { newsItems } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { DataTable } from "@/components/data-table";
import { NewsComposer } from "@/components/news-composer";
import { PriorityBadge, Section, StatusBadge } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export default function AdminNewsPage() {
  return (
    <AppShell title="Admin · News" subtitle="Erstellen, veröffentlichen, terminieren und zielgruppengenau aussteuern">
      <Section title="News anlegen" subtitle="Mit Priorität, Status, Ablaufzeit, Anhängen und Zielgruppenlogik">
        <NewsComposer />
      </Section>
      <Section title="Bestehende News" subtitle="Übersicht über Veröffentlichungen, Prioritäten und Zielgruppen">
        <DataTable
          rows={newsItems}
          columns={[
            { key: "title", header: "Titel", render: (news) => <div><p className="font-semibold text-slate-900">{news.title}</p><p className="text-xs text-slate-500">{news.author}</p></div> },
            { key: "priority", header: "Priorität", render: (news) => <PriorityBadge priority={news.priority} /> },
            { key: "status", header: "Status", render: (news) => <StatusBadge status={news.status} /> },
            { key: "published", header: "Veröffentlicht", render: (news) => formatDate(news.publishedAt) },
            { key: "audience", header: "Zielgruppen", render: (news) => news.audience.join(", ") },
          ]}
        />
      </Section>
    </AppShell>
  );
}
