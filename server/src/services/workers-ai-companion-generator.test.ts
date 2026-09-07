import { describe, expect, it } from "vitest";
import { extractWorkersAiText } from "./workers-ai-companion-generator.js";

describe("extractWorkersAiText", () => {
  it("reads both Workers AI response shapes", () => {
    expect(extractWorkersAiText({ response: "第一种返回" })).toBe("第一种返回");
    expect(extractWorkersAiText({
      choices: [{ message: { content: "第二种返回" } }]
    })).toBe("第二种返回");
  });
});
