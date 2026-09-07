import type { CompanionTextGenerator } from "./companion-autoplay-service.js";

export type WorkersAiBinding = {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
};

export class WorkersAiCompanionGenerator implements CompanionTextGenerator {
  constructor(private readonly ai: WorkersAiBinding) {}

  async generate(input: {
    systemPrompt: string;
    prompt: string;
    maxTokens: number;
    temperature: number;
    responseFormat?: Record<string, unknown>;
  }): Promise<string | null> {
    const result = await this.ai.run("@cf/meta/llama-3.1-8b-instruct-fast", {
      messages: [
        { role: "system", content: input.systemPrompt },
        { role: "user", content: input.prompt }
      ],
      max_tokens: input.maxTokens,
      temperature: input.temperature,
      ...(input.responseFormat ? { response_format: input.responseFormat } : {})
    });
    return extractWorkersAiText(result);
  }
}

export function extractWorkersAiText(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const response = (result as { response?: unknown }).response;
  if (typeof response === "string" && response.trim()) return response.trim();
  if (response && typeof response === "object") return JSON.stringify(response);
  const choices = (result as { choices?: unknown }).choices;
  if (!Array.isArray(choices)) return null;
  const content = (choices[0] as { message?: { content?: unknown } } | undefined)
    ?.message?.content;
  if (typeof content === "string" && content.trim()) return content.trim();
  if (!Array.isArray(content)) return null;
  const text = content
    .flatMap((block) =>
      block && typeof block === "object" &&
      typeof (block as { text?: unknown }).text === "string"
        ? [(block as { text: string }).text]
        : []
    )
    .join("\n")
    .trim();
  return text || null;
}
