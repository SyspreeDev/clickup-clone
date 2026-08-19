import Anthropic from "@anthropic-ai/sdk";
import { env, isAiConfigured } from "../../config/env";
import { AI_TOOLS, runTool } from "./ai.tools";
import { BadRequestError } from "../../lib/errors";

const MODEL = "claude-sonnet-5";
const MAX_TOOL_ITERATIONS = 4;

const SYSTEM_PROMPT =
  "You are the AI assistant inside Teamspree, a project management tool for SySpree Digital. " +
  "Answer questions about the user's projects, tasks, and deadlines using the tools available to you — " +
  "never invent numbers or task names. If a tool returns no data or an error, say so plainly. " +
  "Keep answers short and concrete: lead with the number or fact the user asked for, then any relevant detail.";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: env.anthropicApiKey });
  return client;
}

export interface AiChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AiChatResult {
  reply: string;
  toolsUsed: string[];
}

export async function chat(
  ctx: { userId: string; workspaceId: string },
  userMessage: string,
  history: AiChatMessage[] = [],
): Promise<AiChatResult> {
  if (!isAiConfigured) {
    throw new BadRequestError("The AI assistant isn't configured yet — ask an admin to add an Anthropic API key.");
  }

  const messages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: userMessage },
  ];

  const toolsUsed: string[] = [];

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const response = await getClient().messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: AI_TOOLS,
      messages,
    });

    if (response.stop_reason !== "tool_use") {
      const text = response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "";
      return { reply: text, toolsUsed };
    }

    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      toolsUsed.push(block.name);
      const result = await runTool(block.name, ctx, block.input as Record<string, unknown>);
      toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) });
    }
    messages.push({ role: "user", content: toolResults });
  }

  return {
    reply: "I looked into that but couldn't finish in time — try asking a more specific question.",
    toolsUsed,
  };
}
