import { describe, expect, it } from "vitest";
import type { ReadingDatabase, ReadingPosition } from "@ss/shared";
import type { ReadingRepository } from "../repositories/reading-repository.js";
import { ReadingService } from "./reading-service.js";

class MemoryRepository implements ReadingRepository {
  database: ReadingDatabase = {
    schemaVersion: 5,
    sessions: [],
    quotes: [],
    reactions: [],
    bookmarks: [],
    companionComments: [],
    annotations: [],
    readingEvents: []
  };

  async read() {
    return structuredClone(this.database);
  }

  async mutate<T>(change: (database: ReadingDatabase) => T | Promise<T>) {
    return change(this.database);
  }
}

function position(index: number): ReadingPosition {
  return { kind: "paragraph", index, label: `第 ${index} 段` };
}

function createService() {
  const repository = new MemoryRepository();
  let sequence = 0;
  const sourceText = Array.from(
    { length: 8 },
    (_, index) => `第 ${index + 1} 段正文。${"这是用于验证队列恢复的原创内容。".repeat(20)}`
  ).join("\n\n");
  const service = new ReadingService(
    repository,
    {
      now: () => new Date(Date.UTC(2026, 7, 12, 8, 0, sequence++)),
      id: () => `id-${sequence++}`
    },
    {
      deleteCloudSource: async () => ({ deleted: true, cloudSourceDeleted: true }),
      restoreNovelSource: async () => ({
        sourceText,
        sourceManifest: { segmentationVersion: 2 }
      })
    }
  );
  return { repository, service };
}

async function enableCloudNovel(service: ReadingService, sessionId: string) {
  await service.setSourceManifest(sessionId, {
    sourceId: "source-1",
    sourceKind: "pasted_text",
    contentHash: "a".repeat(64),
    segmentationVersion: 2,
    paragraphCount: 8,
    cloudSync: {
      enabled: true,
      provider: "r2",
      objectKey: "private/sources/source-1/source.txt"
    }
  });
}

describe("ReadingService durable reading events", () => {
  it("rejects live queueing before a recoverable private source exists", async () => {
    const { service } = createService();
    const session = await service.startSession("仅本机", "novel");
    await expect(
      service.enqueueReadingNestEvent({
        sessionId: session.id,
        kind: "live_reading",
        position: position(1),
        requestedMode: "light_chat",
        requestedLength: "short",
        operationId: "live-local-only"
      })
    ).rejects.toMatchObject({
      message: "实时陪读需要可恢复的私人云端正文，请先完成本书的云端同步。"
    });
  });

  it("only advances live progress after Daddy writes the short comment back", async () => {
    const { repository, service } = createService();
    const session = await service.startSession("第一本", "novel");
    await enableCloudNovel(service, session.id);
    await service.updateUserPosition(session.id, position(6));

    const queued = await service.enqueueReadingNestEvent({
      sessionId: session.id,
      kind: "live_reading",
      position: position(6),
      requestedMode: "light_chat",
      requestedLength: "normal",
      operationId: "live-6"
    });

    expect(queued).toMatchObject({ created: true, shouldWake: true, pendingCount: 1 });
    expect(JSON.stringify(repository.database.readingEvents)).not.toContain("正文");
    expect(JSON.stringify(repository.database.readingEvents)).not.toContain("includedText");
    expect((await service.getSessionBundle(session.id)).session.assistantSyncedPosition).toBeNull();
    const tick = await service.tickReadingNest({ sessionId: session.id });
    expect(tick.events[0]).toMatchObject({
      eventId: queued.event.id,
      kind: "live_reading",
      includedText: expect.stringContaining("第 6 段正文")
    });

    const posted = await service.postReadingNestMessage({
      sessionId: session.id,
      eventId: queued.event.id,
      text: "这一下停顿太可疑了，他肯定心里有鬼。"
    });

    expect(posted).toMatchObject({ kind: "live_reading", pendingCount: 0 });
    expect(posted.comment?.operationId).toBe(`reading-event-response:${queued.event.id}`);
    expect((await service.getSessionBundle(session.id)).session.assistantSyncedPosition)
      .toMatchObject({ index: 6 });
    expect(repository.database.companionComments).toHaveLength(1);
  });

  it("is idempotent when the same event is retried", async () => {
    const { repository, service } = createService();
    const session = await service.startSession("第一本", "novel");
    await enableCloudNovel(service, session.id);
    await service.updateUserPosition(session.id, position(2));
    const first = await service.enqueueReadingNestEvent({
      sessionId: session.id,
      kind: "live_reading",
      position: position(2),
      requestedMode: "reaction_only",
      requestedLength: "short",
      operationId: "live-2"
    });
    const repeated = await service.enqueueReadingNestEvent({
      sessionId: session.id,
      kind: "live_reading",
      position: position(2),
      requestedMode: "reaction_only",
      requestedLength: "short",
      operationId: "live-2"
    });
    expect(repeated).toMatchObject({ created: false, shouldWake: true });
    expect(repeated.event.id).toBe(first.event.id);

    await service.postReadingNestMessage({
      sessionId: session.id,
      eventId: first.event.id,
      text: "第一次回复。"
    });
    await service.postReadingNestMessage({
      sessionId: session.id,
      eventId: first.event.id,
      text: "不会覆盖第一次。"
    });
    expect(repository.database.companionComments).toHaveLength(1);
    expect(repository.database.companionComments[0]?.text).toBe("第一次回复。");
  });

  it("prioritizes and persists replies to the user's annotation", async () => {
    const { service } = createService();
    const session = await service.startSession("第一本", "novel");
    const annotation = await service.createAnnotation({
      sessionId: session.id,
      position: position(3),
      anchor: { selectedText: "他主动出声" },
      author: "user",
      comment: "他是不是急了？",
      operationId: "annotation-3"
    });
    const event = await service.enqueueReadingNestEvent({
      sessionId: session.id,
      kind: "annotation_reply",
      annotationId: annotation.id,
      operationId: "reply-event-3"
    });

    const tick = await service.tickReadingNest({ sessionId: session.id });
    expect(tick.events[0]).toMatchObject({
      kind: "annotation_reply",
      annotationId: annotation.id,
      anchor: { selectedText: "他主动出声" }
    });
    const posted = await service.postReadingNestMessage({
      sessionId: session.id,
      eventId: event.event.id,
      text: "对，他这句明显是在抢回主动权。"
    });
    expect(posted.annotation?.messages.at(-1)).toMatchObject({
      author: "assistant",
      text: "对，他这句明显是在抢回主动权。"
    });
    expect((await service.tickReadingNest({ sessionId: session.id })).pendingCount).toBe(0);
  });
});
