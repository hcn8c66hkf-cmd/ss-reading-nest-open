import { describe, expect, it } from "vitest";
import { buildReadingNestWakeMessage } from "./wake-message.js";

describe("buildReadingNestWakeMessage", () => {
  it("requires tick, durable writeback, and an empty queue", () => {
    const message = buildReadingNestWakeMessage("session-1");
    expect(message).toContain("reading_nest_tick");
    expect(message).toContain("reading_nest_post_message");
    expect(message).toContain('"sessionId":"session-1"');
    expect(message).toContain("pendingCount=0");
    expect(message).toContain("不要只在聊天区口头");
  });
});
