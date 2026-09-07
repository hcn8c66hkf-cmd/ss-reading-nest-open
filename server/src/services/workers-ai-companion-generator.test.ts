import { describe, expect, it, vi } from "vitest";
import {
  extractWorkersAiText,
  WorkersAiCompanionGenerator
} from "./workers-ai-companion-generator.js";

describe("extractWorkersAiText", () => {
  it("reads both Workers AI response shapes", () => {
    expect(extractWorkersAiText({ response: "第一种返回" })).toBe("第一种返回");
    expect(extractWorkersAiText({
      choices: [{ message: { content: "第二种返回" } }]
    })).toBe("第二种返回");
  });

  it("uses a direct-response multilingual model for short companion text", async () => {
    const run = vi.fn().mockResolvedValue({ response: "这下终于说出口了。" });
    const generator = new WorkersAiCompanionGenerator({ run });

    await expect(generator.generate({
      systemPrompt: "system",
      prompt: "prompt",
      maxTokens: 180,
      temperature: 0.8
    })).resolves.toBe("这下终于说出口了。");

    expect(run).toHaveBeenCalledWith(
      "@cf/meta/llama-3.1-8b-instruct-fast",
      expect.objectContaining({ max_tokens: 180 })
    );
  });
});
