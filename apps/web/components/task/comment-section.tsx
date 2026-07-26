"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { createComment } from "@/lib/queries/tasks";
import type { TaskDetail } from "@/lib/queries/tasks";

export function CommentSection({ task }: { task: TaskDetail }) {
  const [content, setContent] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => createComment(task.id, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task", task.id] });
      setContent("");
    },
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
              <p className="text-sm">{typeof comment.content === "string" ? comment.content : ""}</p>
            </div>
          </div>
        ))}
        {!task.comments.length && <p className="text-sm text-muted-foreground">No comments yet.</p>}
      </div>

      <div className="flex items-start gap-2.5 pt-2">
        <Avatar className="h-7 w-7 shrink-0">
          <AvatarFallback className="text-xs">{task.createdBy.name[0]}</AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Leave a comment…"
            rows={2}
            className="w-full resize-none rounded-lg border border-border bg-background p-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <Button size="sm" disabled={!content.trim() || mutation.isPending} onClick={() => mutation.mutate()}>
            Comment
          </Button>
        </div>
      </div>
    </div>
  );
}
