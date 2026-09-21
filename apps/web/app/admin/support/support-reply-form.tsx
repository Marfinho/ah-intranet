"use client";

import { CommentForm } from "@/components/comment-form";
import { addSupportMessageAction } from "@/lib/actions";

export function SupportReplyForm({ ticketId }: { ticketId: string }) {
  return (
    <CommentForm
      action={addSupportMessageAction.bind(null, ticketId)}
      placeholder="Antwort an AHOI schreiben …"
      label="Antworten"
    />
  );
}
