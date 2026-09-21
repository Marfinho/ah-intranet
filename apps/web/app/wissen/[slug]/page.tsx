import Link from "next/link";
import { notFound } from "next/navigation";
import type { WikiArticle } from "@ah-intranet/shared";
import { AppShell } from "@/components/app-shell";
import { Section, Tag } from "@/components/ui";
import { ApiError, apiGet } from "@/lib/api";
import { requireModule } from "@/lib/session";
import { formatDate } from "@/lib/utils";

export default async function WikiDetailPage({ params: paramsPromise }: { params: Promise<{ slug: string }> }) {
  const params = await paramsPromise;
  await requireModule("wiki");

  let article: WikiArticle;
  try {
    article = await apiGet<WikiArticle>(`/wiki/${params.slug}`);
  } catch (error) {
    if (error instanceof ApiError && error.isMissing) {
      notFound();
    }
    throw error;
  }

  return (
    <AppShell
      title={article.title}
      subtitle={`${article.category} · zuletzt aktualisiert ${formatDate(article.updatedAt)}`}
    >
      <Section
        title={article.title}
        subtitle={`Verfasst von ${article.author}`}
        action={
          <Link href="/wissen" className="text-sm font-semibold text-brand-700 hover:underline">
            Zurück zur Wissensdatenbank
          </Link>
        }
      >
        <div className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{article.content}</div>

        {article.tags.length > 0 ? (
          <div className="mt-6 flex flex-wrap gap-2">
            {article.tags.map((tag) => (
              <Tag key={tag}>#{tag}</Tag>
            ))}
          </div>
        ) : null}
      </Section>
    </AppShell>
  );
}
