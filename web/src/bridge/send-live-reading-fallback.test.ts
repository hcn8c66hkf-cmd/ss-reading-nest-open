import { describe, expect, it, vi } from "vitest";
import { sendLiveReadingFallback } from "./send-live-reading-fallback.js";

describe("sendLiveReadingFallback", () => {
  const context = { currentText: "a private paragraph" };

  it("updates hidden context before sending only the short wake prompt", async () => {
    const calls: string[] = [];
    const sendMessage = vi.fn(async () => {
      calls.push("message");
      return true;
    });

    const mode = await sendLiveReadingFallback({
      context,
      wakePrompt: "read paragraph 12",
      compatibilityPrompt: "full fallback paragraph",
      updateModelContext: vi.fn(async () => {
        calls.push("context");
        return true;
      }),
      sendMessage
    });

    expect(mode).toBe("context");
    expect(calls).toEqual(["context", "message"]);
    expect(sendMessage).toHaveBeenCalledWith("read paragraph 12", {
      scrollToBottom: false
    });
  });

  it("keeps the full compatibility prompt when hidden context is unavailable", async () => {
    const sendMessage = vi.fn().mockResolvedValue(true);

    const mode = await sendLiveReadingFallback({
      context,
      wakePrompt: "read paragraph 12",
      compatibilityPrompt: "full fallback paragraph",
      updateModelContext: vi.fn().mockResolvedValue(false),
      sendMessage
    });

    expect(mode).toBe("message-fallback");
    expect(sendMessage).toHaveBeenCalledWith("full fallback paragraph", {
      scrollToBottom: false
    });
  });

  it("reports a rejected host delivery", async () => {
    const mode = await sendLiveReadingFallback({
      context,
      wakePrompt: "read paragraph 12",
      compatibilityPrompt: "full fallback paragraph",
      updateModelContext: vi.fn().mockResolvedValue(true),
      sendMessage: vi.fn().mockResolvedValue(false)
    });

    expect(mode).toBe("failed");
  });
});
