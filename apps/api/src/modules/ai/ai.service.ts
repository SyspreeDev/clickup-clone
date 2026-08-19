import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../../lib/prisma";
import { env, isAiConfigured } from "../../config/env";
import { AI_TOOLS, runTool } from "./ai.tools";
import { NotFoundError } from "../../lib/errors";

const MODEL = "claude-sonnet-5";
const MAX_TOOL_ITERATIONS = 6;

const SYSTEM_PROMPT =
  "You are the AI assistant inside Teamspree, a project management tool for SySpree Digital. Answer questions " +
  "about the user's projects, tasks, clients, and deadlines using the tools available to you — never invent " +
  "numbers, task names, or client details.\n\n" +
  "Important domain knowledge: a 'client' is NOT a separate thing in this app — each client is tracked as a " +
  "TASK (usually named after the client, e.g. 'Vastrado' or 'Jewellery & Spices') living inside a delivery " +
  "list such as 'Web Development', 'AMC', or 'SEO'. The client's brief (contact, package, scope, phases) lives " +
  "in that task's description. So when asked for a client summary, treat it exactly like a task lookup: use " +
  "search_workspace to find it, then get_task_details for the full picture — don't say a client 'doesn't exist' " +
  "just because get_project_stats found no matching list; a client is never a list.\n\n" +
  "General approach: if you're not 100% sure where something lives, call search_workspace first rather than " +
  "guessing or giving up — it searches tasks, lists, and people at once. If a tool comes back empty or " +
  "ambiguous, either try a broader search or ask a short clarifying question; never fabricate an answer. " +
  "Keep replies concise and concrete: lead with the direct answer, then supporting detail. Format with " +
  "markdown (bold, bullet lists) where it makes the answer easier to scan.\n\n" +
  "Two content-generation tools produce raw facts for you to write from — they never write the final text " +
  "themselves:\n" +
  "- draft_client_email: call it, then write a complete, ready-to-send email (a 'Subject:' line, then the body) " +
  "grounded only in the facts it returns. If contactEmail is null, tell the user no contact email was found and " +
  "ask for one — never invent an email address. Match tone to the stated purpose (a status update reads " +
  "differently from an overdue follow-up).\n" +
  "- generate_report: call it, then write an actual narrated report with headers and bullets — a manager should " +
  "be able to read it standalone, not just see the raw counts. Call out what's notable (a low completion rate, " +
  "a spike in overdue items, one person carrying most of the open workload), don't just restate every number.";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: env.anthropicApiKey });
  return client;
}

/** First few words of the message, trimmed to a title — same idea as email subject lines. */
function deriveTitle(message: string): string {
  const clean = message.trim().replace(/\s+/g, " ");
  if (clean.length <= 48) return clean;
  return clean.slice(0, 48).replace(/\s+\S*$/, "") + "…";
}

export type AiStreamEvent =
  | { type: "conversation"; conversationId: string }
  | { type: "delta"; text: string }
  | { type: "tool"; name: string }
  | { type: "done"; conversationId: string; reply: string; toolsUsed: string[] }
  | { type: "error"; message: string };

type ToolContext = { userId: string; workspaceId: string };

export async function listConversations(ctx: ToolContext) {
  return prisma.aiConversation.findMany({
    where: { workspaceId: ctx.workspaceId, userId: ctx.userId },
    select: { id: true, title: true, createdAt: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });
}

async function loadOwnedConversation(ctx: ToolContext, conversationId: string) {
  const conversation = await prisma.aiConversation.findUnique({ where: { id: conversationId } });
  if (!conversation || conversation.userId !== ctx.userId || conversation.workspaceId !== ctx.workspaceId) {
    throw new NotFoundError("Conversation not found");
  }
  return conversation;
}

export async function getConversationMessages(ctx: ToolContext, conversationId: string) {
  await loadOwnedConversation(ctx, conversationId);
  return prisma.aiMessage.findMany({
    where: { conversationId },
    select: { id: true, role: true, content: true, toolsUsed: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function deleteConversation(ctx: ToolContext, conversationId: string) {
  await loadOwnedConversation(ctx, conversationId);
  await prisma.aiConversation.delete({ where: { id: conversationId } });
}

/**
 * Streams one turn of a conversation as an async generator of small events —
 * text deltas as Claude writes them, a marker whenever a tool runs, and a
 * final `done` event once the reply (and DB write) is complete. Persists both
 * the user's message and the assistant's reply so the conversation can be
 * resumed later; a brand-new conversation is created (and its id emitted
 * immediately) when `conversationId` is omitted.
 */
export async function* streamChat(
  ctx: ToolContext,
  input: { conversationId?: string; message: string },
): AsyncGenerator<AiStreamEvent> {
  if (!isAiConfigured) {
    yield { type: "error", message: "The AI assistant isn't configured yet — ask an admin to add an Anthropic API key." };
    return;
  }

  let conversationId = input.conversationId;
  let history: { role: "USER" | "ASSISTANT"; content: string }[] = [];

  if (conversationId) {
    await loadOwnedConversation(ctx, conversationId);
    history = await prisma.aiMessage.findMany({
      where: { conversationId },
      select: { role: true, content: true },
      orderBy: { createdAt: "asc" },
    });
  } else {
    const conversation = await prisma.aiConversation.create({
      data: { workspaceId: ctx.workspaceId, userId: ctx.userId, title: deriveTitle(input.message) },
    });
    conversationId = conversation.id;
    yield { type: "conversation", conversationId };
  }

  await prisma.aiMessage.create({ data: { conversationId, role: "USER", content: input.message } });

  const messages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({ role: (m.role === "USER" ? "user" : "assistant") as "user" | "assistant", content: m.content })),
    { role: "user" as const, content: input.message },
  ];

  const toolsUsed: string[] = [];
  let replyText = "";

  try {
    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const stream = getClient().messages.stream({ model: MODEL, max_tokens: 1024, system: SYSTEM_PROMPT, tools: AI_TOOLS, messages });

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          replyText += event.delta.text;
          yield { type: "delta", text: event.delta.text };
        }
      }
      const response = await stream.finalMessage();

      if (response.stop_reason !== "tool_use") {
        await prisma.aiMessage.create({ data: { conversationId, role: "ASSISTANT", content: replyText, toolsUsed } });
        await prisma.aiConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
        yield { type: "done", conversationId, reply: replyText, toolsUsed };
        return;
      }

      messages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        toolsUsed.push(block.name);
        yield { type: "tool", name: block.name };
        const result = await runTool(block.name, ctx, block.input as Record<string, unknown>);
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) });
      }
      messages.push({ role: "user", content: toolResults });
    }

    const fallback = "I looked into that but couldn't finish in time — try asking a more specific question.";
    await prisma.aiMessage.create({ data: { conversationId, role: "ASSISTANT", content: fallback, toolsUsed } });
    await prisma.aiConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
    yield { type: "done", conversationId, reply: fallback, toolsUsed };
  } catch (err) {
    yield { type: "error", message: err instanceof Error ? err.message : "Something went wrong talking to the AI." };
  }
}
