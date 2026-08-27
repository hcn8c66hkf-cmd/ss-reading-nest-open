import { describe, expect, it, vi } from "vitest";
import { sendLiveReadingFallback } from "./send-live-reading-fallback.js";

describe("sendLiveReadingFallback", () => {
  it("always sends the complete prompt directly instead of relying on hidden context", async () => {
    const sendMessage = vi.fn().mockResolvedValue(true);
    const prompt = "read paragraph 12\n\nfull paragraph body";

    const mode = await sendLiveReadingFallback({
      prompt,
      sendMessage
    });

    expect(mode).toBe("message");
    expect(sendMessage).toHaveBeenCalledWith(prompt, {
      scrollToBottom: false
    });
  });

  it("reports a rejected host delivery", async () => {
    const mode = await sendLiveReadingFallback({
      prompt: "read paragraph 12\n\nfull paragraph body",
      sendMessage: vi.fn().mockResolvedValue(false)
    });

    expect(mode).toBe("failed");
  });
});
