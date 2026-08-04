"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RichTextComposer, RichTextContent } from "@/components/ui/rich-text";
import { createComment } from "@/lib/queries/tasks";
import { ApiError } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";
import type { TaskDetail } from "@/lib/queries/tasks";

export function CommentSection({ task }: { task: TaskDetail }) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const mutation = useMutation({
    mutationFn: (content: unknown) => createComment(task.id, { content }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["task", task.id] }),
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not post comment"),
  });

  return (
    <div className="space-y-4">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <MessageSquare className="h-4 w-4" />
        Comments ({task.comments.length})
      </p>

      <div className="space-y-4">
        {task.comments.map((comment) => (
          <div key={comment.id} className="flex gap-2.5">
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarImage src={comment.author.avatarUrl ?? undefined} />
              <AvatarFallback className="text-xs">{comment.author.name[0]}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{comment.author.name}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                </span>
              </div>
              {/* Comments written before the editor existed are plain strings; the
                  renderer normalises both shapes. */}
              <RichTextContent value={comment.content} className="text-foreground" />
            </div>
          </div>
        ))}
        {!task.comments.length && <p className="text-sm text-muted-foreground">No comments yet.</p>}
      </div>

      <div className="flex items-start gap-2.5 pt-2">
        <Avatar className="h-7 w-7 shrink-0">
          <AvatarImage src={user?.avatarUrl ?? undefined} />
          <AvatarFallback className="text-xs">{(user?.name ?? "?")[0]}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <RichTextComposer
            placeholder="Leave a comment…"
            submitLabel="Comment"
            disabled={mutation.isPending}
            onSubmit={async (doc) => {
              await mutation.mutateAsync(doc);
            }}
          />
        </div>
      </div>
    </div>
  );
}
