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
  it("generates and persists a pending paragraph without a ChatGPT follow-up", async () => {
    const { reading, source, session } = await setup();
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
      comment: { text: "这段的笑点来得太准了。", position: { index: 2 } }
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
