import { describe, expect, it } from "vitest";
import {
  buildChapterSnapshot,
  buildSkillForgeConversationPrompt,
  buildSkillForgePrompt,
  parseSkillForgeDraft,
  SKILL_FORGE_SAMPLING_TOOL,
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

  it("builds a model-visible fallback that persists one verdict", () => {
    const item = snapshot();
    const prompt = buildSkillForgeConversationPrompt(item);
    expect(prompt).toContain("调用 upsert_skill_candidate 恰好一次");
    expect(prompt).toContain(`\"analysisFingerprint\":\"${item.fingerprint}\"`);
    expect(prompt).toContain(`\"operationId\":\"skill-candidate-v38:${item.fingerprint}\"`);
    expect(prompt).toContain("不要调用 save_quote");
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

  it("extracts JSON when the host wraps the verdict in prose and a code fence", () => {
    const draft = parseSkillForgeDraft([
      "我会严格按门槛判断：",
      "```json",
      JSON.stringify({
        verdict: "knowledge_only",
        title: "人物关系观察",
        rationale: "这是剧情知识，还不是可复用流程。",
        triggerExamples: [],
        workflow: [],
        boundaries: ["不触发技能"],
        sourceNotes: ["仅覆盖当前范围"]
      }),
      "```",
      "以上是判定。"
    ].join("\n"));

    expect(draft).toMatchObject({
      verdict: "knowledge_only",
      title: "人物关系观察"
    });
  });

  it("accepts the localized verdict label used by the review UI", () => {
    const draft = parseSkillForgeDraft(JSON.stringify({
      verdict: "材料还不够",
      title: "继续积累",
      rationale: "当前范围不足以形成稳定工作流。",
      triggerExamples: [],
      workflow: [],
      boundaries: [],
      sourceNotes: []
    }));

    expect(draft?.verdict).toBe("insufficient_coverage");
  });

  it("can build a smaller format-repair retry prompt", () => {
    const prompt = buildSkillForgePrompt(snapshot(), { bodyLimit: 32, compact: true });

    expect(prompt).toContain("格式修复重试");
    expect(prompt).toContain("JSON 控制在 1200 字以内");
  });

  it("builds a tool-delivered prompt without conflicting JSON-only instructions", () => {
    const prompt = buildSkillForgePrompt(snapshot(), {
      toolName: SKILL_FORGE_SAMPLING_TOOL.name
    });

    expect(prompt).toContain("必须调用 submit_skill_forge_verdict 一次提交判定");
    expect(prompt).not.toContain("只输出一个 JSON 对象");
    expect(SKILL_FORGE_SAMPLING_TOOL.inputSchema.required).toContain("verdict");
  });
});
