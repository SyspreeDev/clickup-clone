"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { AiChatPanel } from "@/components/ai/ai-chat-panel";
import { getAiConversation } from "@/lib/queries/ai";
import { Skeleton } from "@/components/ui/skeleton";

export default function AiConversationPage({
  params,
}: {
  params: Promise<{ workspaceId: string; conversationId: string }>;
}) {
  const { workspaceId, conversationId } = use(params);

  const { data: messages, isLoading } = useQuery({
    queryKey: ["ai-conversation", workspaceId, conversationId],
    queryFn: () => getAiConversation(workspaceId, conversationId),
  });

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-16 w-2/3" />
        <Skeleton className="ml-auto h-10 w-1/2" />
        <Skeleton className="h-20 w-3/4" />
      </div>
    );
  }

  return <AiChatPanel key={conversationId} workspaceId={workspaceId} conversationId={conversationId} initialMessages={messages} />;
}
