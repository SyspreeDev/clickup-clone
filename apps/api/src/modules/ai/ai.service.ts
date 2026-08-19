import Anthropic from "@anthropic-ai/sdk";
import { env, isAiConfigured } from "../../config/env";
import { AI_TOOLS, runTool } from "./ai.tools";
import { BadRequestError } from "../../lib/errors";

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
  "Keep replies concise and concrete: lead with the direct answer, then supporting detail.";

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
