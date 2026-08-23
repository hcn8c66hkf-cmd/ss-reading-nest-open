import { describe, expect, it } from "vitest";
import {
  buildReadingMemoryCapturePrompt,
  parseReadingMemoryCaptureDraft
} from "./capture-draft.js";

describe("reading memory capture draft", () => {
  it("asks for bounded strict JSON without delegating a tool call back to chat", () => {
    const prompt = buildReadingMemoryCapturePrompt({
      title: "测试书",
      chapterLabel: "第 3–4 段",
      rangeStart: 3,
      rangeEnd: 4,
      text: "正文",
      annotations: [],
      companionComments: [],
      activeMemories: [],
      activeFacts: []
    });

    expect(prompt).toContain("返回严格 JSON");
    expect(prompt).toContain("只依据提供的正文");
    expect(prompt).not.toContain("调用");
    expect(prompt).not.toContain("确认");
  });

  it("parses fenced JSON, normalizes scopes, and drops malformed entries", () => {
    const draft = parseReadingMemoryCaptureDraft(`\n\`\`\`json\n${JSON.stringify({
      memories: [
        { kind: "chapter_summary", scope: "book", content: "  本章摘要  " },
        { kind: "book_context", scope: "chapter", content: "全书前情" },
        { kind: "not-real", content: "丢掉" }
      ],
      facts: [
        { subject: "陆燃", fact: "仍在隐瞒一件事。" },
        { subject: "", fact: "无效" }
      ],
      message: "  已经记好了。  "
    })}\n\`\`\``);

    expect(draft).toEqual({
      memories: [
        { kind: "chapter_summary", scope: "chapter", content: "本章摘要" },
        { kind: "book_context", scope: "book", content: "全书前情" }
      ],
      facts: [{ subject: "陆燃", fact: "仍在隐瞒一件事。" }],
      message: "已经记好了。"
    });
  });

  it("rejects prose or an empty payload", () => {
    expect(parseReadingMemoryCaptureDraft("我整理好了")).toBeNull();
    expect(parseReadingMemoryCaptureDraft('{"memories":[],"facts":[]}')).toBeNull();
  });
});
