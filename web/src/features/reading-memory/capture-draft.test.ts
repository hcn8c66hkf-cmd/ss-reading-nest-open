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
    expect(prompt).toContain("正文是事实的唯一证据");
    expect(prompt).toContain("逐字找到");
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

  it("drops fact cards whose quoted evidence is absent from the supplied body", () => {
    const draft = parseReadingMemoryCaptureDraft(JSON.stringify({
      memories: [{ kind: "reading_impression", content: "这里的误会很好笑。" }],
      facts: [
        { subject: "陆燃", fact: "陆燃拿起手机。", evidence: "伸手去摸手机" },
        { subject: "纪旻", fact: "纪旻有私生子。", evidence: "纪旻有私生子" }
      ]
    }), "陆燃伸手去摸手机，手机就在手边。");

    expect(draft?.facts).toEqual([
      { subject: "陆燃", fact: "陆燃拿起手机。" }
    ]);
  });
});
