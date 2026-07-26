/**
 * Extension point for AI Task Summary / AI Project Insights.
 * Not implemented in this build — wire a real provider (Anthropic/OpenAI/etc)
 * behind this interface when ready. The frontend renders a "Coming soon"
 * affordance wherever these are called (see M8).
 */
export interface AiInsightsProvider {
  summarizeTask(input: { title: string; description?: string; comments: string[] }): Promise<string>;
  summarizeProjectHealth(input: { projectName: string; stats: Record<string, number> }): Promise<string>;
}

class UnimplementedAiInsightsProvider implements AiInsightsProvider {
  async summarizeTask(): Promise<string> {
    throw new AiNotConfiguredError();
  }
  async summarizeProjectHealth(): Promise<string> {
    throw new AiNotConfiguredError();
  }
}

export class AiNotConfiguredError extends Error {
  constructor() {
    super("AI insights are not configured yet.");
    this.name = "AiNotConfiguredError";
  }
}

export const aiInsightsProvider: AiInsightsProvider = new UnimplementedAiInsightsProvider();
