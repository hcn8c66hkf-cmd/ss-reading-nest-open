import { describe, expect, it } from "vitest";
import type { ReadingDatabase } from "@ss/shared";
import type { ReadingRepository } from "../repositories/reading-repository.js";
import { ReadingService } from "./reading-service.js";

class MemoryRepository implements ReadingRepository {
  database: ReadingDatabase = {
    schemaVersion: 6,
    sessions: [],
    quotes: [],
    reactions: [],
    bookmarks: [],
    companionComments: [],
    annotations: [],
    annotationFavorites: [],
    readingMemories: [],
    readingFactCards: []
  };

  async read() {
    return structuredClone(this.database);
  }

  async mutate<T>(change: (database: ReadingDatabase) => T | Promise<T>) {
    return change(this.database);
  }
}

function setup() {
  const repository = new MemoryRepository();
  let sequence = 0;
  const service = new ReadingService(repository, {
    now: () => new Date(Date.UTC(2026, 7, 23, 12, 0, sequence)),
    id: () => `id-${++sequence}`
  });
  return { repository, service };
}

describe("ReadingService favorites and long-term memory", () => {
  it("favorites an exact annotation reply idempotently and removes it", async () => {
    const { repository, service } = setup();
    const session = await service.startSession("共读书", "novel");
    const annotation = await service.createAnnotation({
      sessionId: session.id,
      position: { kind: "paragraph", index: 5, label: "第 5 段" },
      anchor: { selectedText: "她没有回头", startOffset: 2, endOffset: 8 },
      author: "user",
      comment: "这里很狠。",
      operationId: "annotation-op"
    });
    const messageId = annotation.messages[0].id;

    const first = await service.setAnnotationFavorite({
      sessionId: session.id,
      annotationId: annotation.id,
      messageId,
      favorite: true,
      operationId: "favorite-op-1"
    });
    const repeated = await service.setAnnotationFavorite({
      sessionId: session.id,
      annotationId: annotation.id,
      messageId,
      favorite: true,
      operationId: "favorite-op-2"
    });

    expect(repeated.item?.id).toBe(first.item?.id);
    expect(repository.database.annotationFavorites).toHaveLength(1);
    expect((await service.listAnnotationFavorites(session.id)).favorites[0])
      .toMatchObject({ excerpt: "她没有回头", text: "这里很狠。" });

    await service.setAnnotationFavorite({
      sessionId: session.id,
      annotationId: annotation.id,
      messageId,
      favorite: false,
      operationId: "favorite-remove"
    });
    expect(repository.database.annotationFavorites).toEqual([]);
  });

  it("preserves memory revisions and their source labels", async () => {
    const { service } = setup();
    const session = await service.startSession("共读书", "novel");
    const first = await service.upsertReadingMemory({
      sessionId: session.id,
      kind: "chapter_summary",
      scope: "chapter",
      chapterLabel: "第 1–10 段",
      rangeStart: 1,
      rangeEnd: 10,
      content: "第一版摘要",
      source: "daddy_read",
      operationId: "memory-op-1"
    });
    const revised = await service.upsertReadingMemory({
      sessionId: session.id,
      kind: "chapter_summary",
      scope: "chapter",
      chapterLabel: "第 1–10 段",
      rangeStart: 1,
      rangeEnd: 10,
      content: "小安修订后的摘要",
      source: "user_edit",
      supersedesId: first.id,
      operationId: "memory-op-2"
    });

    expect(revised).toMatchObject({ revision: 2, source: "user_edit", supersedesId: first.id });
    expect((await service.listReadingMemories({ sessionId: session.id })).memories)
      .toEqual([expect.objectContaining({ id: revised.id, status: "active" })]);
    expect((await service.listReadingMemories({
      sessionId: session.id,
      includeSuperseded: true
    })).memories).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: first.id, status: "superseded" }),
      expect.objectContaining({ id: revised.id, status: "active" })
    ]));
  });

  it("keeps daily context light and deep context complete", async () => {
    const { service } = setup();
    const session = await service.startSession("共读书", "novel");
    for (const [kind, content] of [
      ["book_context", "全书前情"],
      ["chapter_context", "章节前情"],
      ["reading_impression", "共同余味"],
      ["chapter_summary", "详细章节摘要"],
      ["annotation_summary", "批注摘要"]
    ] as const) {
      await service.upsertReadingMemory({
        sessionId: session.id,
        kind,
        scope: kind === "book_context" ? "book" : "chapter",
        ...(kind === "book_context" ? {} : { chapterLabel: "第 1–10 段" }),
        rangeStart: 1,
        rangeEnd: 10,
        content,
        source: "daddy_read",
        operationId: `memory-${kind}`
      });
    }
    const fact = await service.upsertReadingFact({
      sessionId: session.id,
      subject: "角色A",
      fact: "仍不知道真相",
      source: "daddy_read",
      operationId: "fact-op-1"
    });
    const revisedFact = await service.upsertReadingFact({
      sessionId: session.id,
      subject: "角色A",
      fact: "已经知道真相",
      source: "user_edit",
      supersedesId: fact.id,
      operationId: "fact-op-2"
    });

    const daily = await service.getLayeredReadingContext({
      sessionId: session.id,
      depth: "daily",
      positionIndex: 5
    });
    const deep = await service.getLayeredReadingContext({
      sessionId: session.id,
      depth: "deep",
      positionIndex: 5
    });

    expect(daily.memories.map((item) => item.kind)).toEqual([
      "book_context",
      "chapter_context",
      "reading_impression"
    ]);
    expect(deep.memories).toHaveLength(5);
    expect(daily.facts).toEqual([
      expect.objectContaining({ id: revisedFact.id, source: "user_edit", status: "active" })
    ]);
  });
});
