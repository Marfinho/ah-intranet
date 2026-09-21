import Link from "next/link";
import { notFound } from "next/navigation";
import type { NewsItem } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { PriorityBadge, Section, StatusBadge, Tag } from "@/components/ui";
import { CommentForm } from "@/components/comment-form";
import { MarkReadOnView } from "@/components/mark-read-on-view";
import { ApiError, apiGet } from "@/lib/api";
import { requireModule } from "@/lib/session";
import { commentNewsAction } from "@/lib/actions";
import { formatDate, formatDateTime } from "@/lib/utils";

export default async function NewsDetailPage({ params: paramsPromise }: { params: Promise<{ slug: string }> }) {
  const params = await paramsPromise;
  await requireModule("news");

  let article: NewsItem;
  try {
    article = await apiGet<NewsItem>(`/news/${params.slug}`);
  } catch (error) {
    if (error instanceof ApiError && (error.isMissing || error.status === 403)) {
      notFound();
    }
    throw error;
  }

  return (
    <AppShell title={article.title} subtitle={`Beitrag von ${article.author}`}>
      <MarkReadOnView slug={article.slug} alreadyRead={article.read} />

      <Section
        title={article.title}
        subtitle={article.teaser}
        action={
          <Link href="/aktuelles" className="text-sm font-semibold text-brand-700 hover:underline">
            Zurück zur Übersicht
          </Link>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <PriorityBadge priority={article.priority} />
          <StatusBadge status={article.status} />
          <span className="text-xs text-slate-500">
            {article.publishedAt ? formatDate(article.publishedAt) : "nicht veröffentlicht"}
            {article.expiresAt ? ` · gültig bis ${formatDate(article.expiresAt)}` : ""}
          </span>
        </div>

        <div className="prose mt-5 max-w-none whitespace-pre-line text-sm leading-relaxed text-slate-700">
          {article.content}
        </div>

        {article.attachments.length > 0 ? (
          <div className="mt-6">
            <p className="text-sm font-semibold text-slate-900">Anhänge</p>
            <ul className="mt-2 space-y-2">
              {article.attachments.map((attachment) => (
                <li key={attachment.id}>
                  <a href={attachment.url} className="text-sm font-medium text-brand-700 hover:underline">
                    {attachment.fileName}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2">
          {article.audienceScopes.map((scope) => (
            <Tag key={scope}>{scope === "global" ? "Alle Mitarbeitenden" : scope}</Tag>
          ))}
        </div>
      </Section>

      <Section title={`Kommentare (${article.comments?.length ?? 0})`} subtitle="Rückfragen und Hinweise zum Beitrag">
        <div className="space-y-4">
          {article.comments?.length ? (
            <ul className="space-y-3">
              {article.comments.map((comment) => (
                <li key={comment.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900">{comment.author}</span>
                    <span className="text-xs text-slate-500">{formatDateTime(comment.createdAt)}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{comment.message}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-600">Noch keine Kommentare.</p>
          )}

          <CommentForm action={commentNewsAction.bind(null, article.slug)} placeholder="Kommentar schreiben …" />
        </div>
      </Section>
    </AppShell>
  );
}
