"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { AiChatPanel } from "@/components/ai/ai-chat-panel";

export default function NewAiChatPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = use(params);
  const router = useRouter();

  return (
    <AiChatPanel
      key="new"
      workspaceId={workspaceId}
      onConversationCreated={(conversationId) => router.replace(`/workspace/${workspaceId}/ai/${conversationId}`)}
    />
  );
}
