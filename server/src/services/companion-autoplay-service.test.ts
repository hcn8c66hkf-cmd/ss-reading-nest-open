import { describe, expect, it, vi } from "vitest";
import type { ReadingDatabase } from "@ss/shared";
import type { ReadingRepository } from "../repositories/reading-repository.js";
import { MemorySourceObjectStorage } from "../storage/memory-source-object-storage.js";
import { CloudSourceService } from "./cloud-source-service.js";
import {
  CompanionAutoplayService,
  type CompanionTextGenerator
} from "./companion-autoplay-service.js";
import { ReadingService } from "./reading-service.js";

class MemoryRepository implements ReadingRepository {
  database: ReadingDatabase = {
    schemaVersion: 7,
    sessions: [],
    quotes: [],
    reactions: [],
    bookmarks: [],
    companionComments: [],
    annotations: [],
    annotationFavorites: [],
    readingMemories: [],
    readingFactCards: [],
    skillCandidates: []
  };

  async read() {
    return structuredClone(this.database);
  }

  async mutate<T>(change: (database: ReadingDatabase) => T | Promise<T>) {
    return change(this.database);
  }
}

async function setup() {
  const repository = new MemoryRepository();
  let sequence = 0;
  const deps = {
    now: () => new Date(Date.UTC(2026, 8, 7, 9, 0, sequence)),
    id: () => `id-${++sequence}`
  };
  const reading = new ReadingService(repository, deps);
  const source = new CloudSourceService(
    repository,
    new MemorySourceObjectStorage(),
    deps,
    "d1"
  );
  const session = await reading.startSession("自动陪读测试", "novel");
  await reading.updateSessionPreferences(session.id, {
    autoSaveCompanionComments: true
  });
  await source.uploadNovelSource({
    sessionId: session.id,
    sourceText: ["开场。", "1.", "第二段笑点。", "2.", "第三段反转。"].join("\n"),
    sourceKind: "pasted_text",
    title: session.title
  });
  return { repository, reading, source, session };
}

describe("CompanionAutoplayService", () => {
  it("generates diary, memory, and P3 artifacts through the server model", async () => {
    const { reading, source, session } = await setup();
    const p3Result = '{"verdict":"knowledge_only","title":"只留知识","rationale":"不是工作流","skillName":"","description":"","triggerExamples":[],"workflow":[],"boundaries":[],"sourceNotes":[]}';
    const generate = vi.fn().mockResolvedValue(p3Result);
    const autoplay = new CompanionAutoplayService(reading, source, { generate });

    await expect(autoplay.generateReadingArtifact(session.id, "diary", "日记素材"))
      .resolves.toBe(p3Result);
    await expect(autoplay.generateReadingArtifact(session.id, "memory", "记忆素材"))
      .resolves.toBe(p3Result);
    await expect(autoplay.generateReadingArtifact(session.id, "skill_forge", "P3 素材"))
      .resolves.toBe(p3Result);

    expect(generate).toHaveBeenNthCalledWith(1, expect.objectContaining({
      prompt: expect.stringContaining("今天读到"),
      maxTokens: 420
    }));
    expect(generate).toHaveBeenNthCalledWith(2, expect.objectContaining({
      prompt: "记忆素材",
      maxTokens: 1_400,
      responseFormat: expect.objectContaining({ type: "json_schema" })
    }));
    expect(generate).toHaveBeenNthCalledWith(3, expect.objectContaining({
      prompt: "P3 素材",
      maxTokens: 1_800,
      responseFormat: expect.objectContaining({ type: "json_schema" })
    }));
  });

  it("normalizes an incomplete P3 verdict into a complete safe result", async () => {
    const { reading, source, session } = await setup();
    const autoplay = new CompanionAutoplayService(reading, source, {
      generate: vi.fn().mockResolvedValue('{"verdict":"材料还不够"}')
    });

    const generated = await autoplay.generateReadingArtifact(session.id, "skill_forge", "P3 素材");

    expect(JSON.parse(generated!)).toEqual({
      verdict: "insufficient_coverage",
      title: "目前材料还不够",
      rationale: "当前已读内容还不足以判断是否存在可复用的方法，继续读后再评估更可靠。",
      skillName: "",
      description: "",
      triggerExamples: [],
      workflow: [],
      boundaries: [],
      sourceNotes: []
    });
  });

  it("returns a complete conservative P3 verdict even when generation fails", async () => {
    const { reading, source, session } = await setup();
    const autoplay = new CompanionAutoplayService(reading, source, {
      generate: vi.fn().mockRejectedValue(new Error("model unavailable"))
    });

    const generated = await autoplay.generateReadingArtifact(session.id, "skill_forge", "P3 素材");

    expect(JSON.parse(generated)).toMatchObject({
      verdict: "insufficient_coverage",
      title: "这次先不硬炼",
      workflow: []
    });
  });

  it("uses a private, non-school-essay voice for diary generation", async () => {
    const { reading, source, session } = await setup();
    const generate = vi.fn().mockResolvedValue("随笔正文");
    const autoplay = new CompanionAutoplayService(reading, source, { generate });

    await autoplay.generateReadingArtifact(session.id, "diary", "请完整转述总结章节剧情");

    expect(generate).toHaveBeenCalledWith(expect.objectContaining({
      systemPrompt: expect.stringContaining("剧情交代最多一句"),
      prompt: expect.not.stringContaining("完整转述总结章节剧情")
    }));
  });

  it("uses chatty reaction prompts for paragraph comments", async () => {
    const { reading, source, session } = await setup();
    await reading.updateSessionPreferences(session.id, {
      readingCommentMode: "cp_talk",
      commentLength: "normal"
    });
    await reading.updateUserPosition(session.id, {
      kind: "paragraph", index: 2, total: 3, label: "第 2 段"
    });
    await reading.setLiveReadingMode(session.id, true);
    const generate = vi.fn().mockResolvedValue("笑死，这一下也太损了。");
    const autoplay = new CompanionAutoplayService(reading, source, { generate });

    await autoplay.completeParagraph(session.id, 2);

    expect(generate).toHaveBeenCalledWith(expect.objectContaining({
      systemPrompt: expect.stringContaining("嗑一下"),
      prompt: expect.stringContaining("最多 220 字")
    }));
  });

  it("generates and persists a pending paragraph without a ChatGPT follow-up", async () => {
    const { reading, source, session } = await setup();
    await reading.updateSessionPreferences(session.id, {
      readingCommentMode: "reaction_only",
      commentLength: "short"
    });
    await reading.updateUserPosition(session.id, {
      kind: "paragraph",
      index: 2,
      total: 3,
      label: "第 2 段"
    });
    await reading.setLiveReadingMode(session.id, true);
    const generate = vi.fn().mockResolvedValue("短评：这段的笑点来得太准了。 ");
    const autoplay = new CompanionAutoplayService(
      reading,
      source,
      { generate } satisfies CompanionTextGenerator
    );

    const result = await autoplay.completeParagraph(session.id, 2);

    expect(result).toMatchObject({
      completed: true,
      kind: "paragraph",
      comment: {
        text: "这段的笑点来得太准了。",
        position: { index: 2 },
        mode: "reaction_only",
        length: "short"
      }
    });
    expect(generate).toHaveBeenCalledTimes(1);
    expect((await reading.getSessionBundle(session.id)).session)
      .toMatchObject({ assistantSyncedPosition: { index: 2 } });
  });

  it("answers a pending annotation and clears its durable reply task", async () => {
    const { reading, source, session } = await setup();
    const annotation = await reading.createAnnotation({
      sessionId: session.id,
      position: { kind: "paragraph", index: 2, total: 3, label: "第 2 段" },
      anchor: { selectedText: "第二段笑点" },
      author: "user",
      comment: "笑死我了",
      operationId: "annotation-user-1"
    });
    const autoplay = new CompanionAutoplayService(reading, source, {
      generate: vi.fn().mockResolvedValue("我也笑了，这一下太损了。")
    });

    const result = await autoplay.completeAnnotation(session.id, annotation.id);

    expect(result).toMatchObject({
      completed: true,
      kind: "annotation",
      annotation: {
        messages: [
          { author: "user", text: "笑死我了" },
          { author: "assistant", text: "我也笑了，这一下太损了。" }
        ]
      }
    });
    expect((await reading.getSessionBundle(session.id)).session.pendingAnnotationReplies)
      .toEqual([]);
  });
});
