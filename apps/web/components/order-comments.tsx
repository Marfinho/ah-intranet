import type { OrderComment } from "@ah-intranet/shared";
import { formatDate } from "@/lib/utils";

export function OrderComments({ comments }: { comments: OrderComment[] }) {
  return (
    <div className="space-y-3">
      {comments.map((comment) => (
        <div key={comment.id} className="rounded-2xl border border-slate-200 p-4">
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <p className="font-semibold text-slate-900">{comment.author}</p>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
              <span>{comment.scope}</span>
              <span>{formatDate(comment.createdAt)}</span>
            </div>
          </div>
          <p className="mt-2 text-sm text-slate-700">{comment.message}</p>
        </div>
      ))}
    </div>
  );
}
