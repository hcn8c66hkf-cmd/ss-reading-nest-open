import { describe, expect, it } from "vitest";
import {
  buildChapterSnapshot,
  buildSkillForgePrompt,
  parseSkillForgeDraft,
  toPersistedSkillCandidate
} from "./skill-forge.js";

function snapshot() {
  return buildChapterSnapshot({
    sessionId: "session-1",
    bookTitle: "测试书",
    readingType: "novel",
    rangeStart: 1,
    rangeEnd: 2,
    totalUnits: 10,
    body: "第一段\n\n第二段",
    annotations: [
      {
        id: "annotation-1",
        sessionId: "session-1",
        position: { kind: "paragraph", index: 2, label: "第 2 段" },
        anchor: { selectedText: "第二段" },
        createdBy: "user",
        messages: [
          {
            id: "message-1",
            author: "user",
            text: "这个判断可以复用吗？",
            createdAt: "2026-08-23T00:00:00.000Z"
          }
        ],
        createdAt: "2026-08-23T00:00:00.000Z",
        updatedAt: "2026-08-23T00:00:00.000Z"
      }
    ],
    comments: [],
    quotes: [],
    reactions: [],
    memories: [],
    facts: []
  });
}

describe("P3 skill forge", () => {
  it("builds a stable Cove-compatible snapshot fingerprint", () => {
    const first = snapshot();
    const second = snapshot();

    expect(first.fingerprint).toMatch(/^snapshot-v1-[a-f0-9]{8}$/);
    expect(second.fingerprint).toBe(first.fingerprint);
    expect(first.annotationThreads).toEqual([
      "第 2 段 · 小安：这个判断可以复用吗？"
    ]);
    expect(first.scope).toBe("chapter");
  });

  it("keeps the high forge threshold explicit in the prompt", () => {
    const prompt = buildSkillForgePrompt(snapshot());
    expect(prompt).toContain("不要因为用户想试功能就硬造 Skill");
    expect(prompt).toContain("未读完全书时，不得声称这是全书 Skill");
    expect(prompt).toContain("knowledge_only");
  });

  it("normalizes a forge verdict into a valid reviewable SKILL.md", () => {
    const draft = parseSkillForgeDraft(JSON.stringify({
      verdict: "forge_skill",
      title: "递进复盘提问",
      rationale: "这是一套可以重复执行的提问流程。",
      skillName: "Reflection Prompts!",
      description: "把阅读记录变成递进复盘问题。",
      triggerExamples: ["帮我复盘这一章"],
      workflow: ["找出转折", "生成递进问题"],
      boundaries: ["不补写未读剧情"],
      sourceNotes: ["仅覆盖当前章节"]
    }));
    expect(draft).not.toBeNull();
    const persisted = toPersistedSkillCandidate(snapshot(), draft!);

    expect(persisted.skillName).toBe("reflection-prompts");
    expect(persisted.description).toMatch(/^Use when/);
    expect(persisted.skillMarkdown).toContain("name: reflection-prompts");
    expect(persisted.skillMarkdown).toContain("## Workflow");
    expect(persisted.skillMarkdown).not.toContain("session-1");
  });

  it("stores a knowledge-only verdict without fabricating a Skill", () => {
    const draft = parseSkillForgeDraft(JSON.stringify({
      verdict: "knowledge_only",
      title: "人物关系观察",
      rationale: "只有剧情知识，没有可复用流程。",
      triggerExamples: [],
      workflow: [],
      boundaries: ["不触发技能"],
      sourceNotes: ["当前材料有限"]
    }));
    const persisted = toPersistedSkillCandidate(snapshot(), draft!);

    expect(persisted.verdict).toBe("knowledge_only");
    expect(persisted.skillMarkdown).toBeUndefined();
    expect(persisted.skillName).toBeUndefined();
  });
});
