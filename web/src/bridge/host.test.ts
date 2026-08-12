import { beforeEach, describe, expect, it, vi } from "vitest";

const bridge = {
  connect: vi.fn().mockResolvedValue(undefined),
  callServerTool: vi.fn(),
  sendMessage: vi.fn().mockResolvedValue(undefined),
  getHostCapabilities: vi.fn().mockReturnValue({ sampling: {} }),
  createSamplingMessage: vi.fn(),
  updateModelContext: vi.fn().mockResolvedValue({}),
  requestDisplayMode: vi.fn().mockResolvedValue({ mode: "fullscreen" })
};

vi.mock("@modelcontextprotocol/ext-apps", () => ({
  App: class {
    connect = bridge.connect;
    callServerTool = bridge.callServerTool;
    sendMessage = bridge.sendMessage;
    getHostCapabilities = bridge.getHostCapabilities;
    createSamplingMessage = bridge.createSamplingMessage;
    updateModelContext = bridge.updateModelContext;
    requestDisplayMode = bridge.requestDisplayMode;
  }
}));

describe("host bridge", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    Object.defineProperty(window, "parent", {
      configurable: true,
      value: {}
    });
    Object.defineProperty(window, "openai", {
      configurable: true,
      value: {
        setWidgetState: vi.fn(),
        sendFollowUpMessage: vi.fn().mockResolvedValue(undefined),
        widgetState: {
          screen: "novel",
          sessionId: "session-1",
          positionIndex: 2,
          scrollTop: 120
        }
      }
    });
  });

  it("updates model-visible context through the MCP Apps bridge", async () => {
    const { updateModelContext } = await import("./host.js");

    await expect(updateModelContext({ title: "Book", currentText: "paragraph" })).resolves.toBe(true);
    expect(bridge.updateModelContext).toHaveBeenCalledWith({
      content: [
        {
          type: "text",
          text: expect.stringContaining('"currentText":"paragraph"')
        }
      ]
    });
  });

  it("requests fullscreen and prefers the Work follow-up compatibility path", async () => {
    const { askChatGpt, requestReaderFullscreen } = await import("./host.js");

    await expect(requestReaderFullscreen()).resolves.toBe(true);
    await askChatGpt("陪我看看这里", { scrollToBottom: false });

    expect(bridge.requestDisplayMode).toHaveBeenCalledWith({ mode: "fullscreen" });
    expect(window.openai?.sendFollowUpMessage).toHaveBeenCalledWith({
      prompt: "陪我看看这里",
      scrollToBottom: false
    });
    expect(bridge.sendMessage).not.toHaveBeenCalled();
  });

  it("falls back to the shared message bridge when the Work alias rejects", async () => {
    if (window.openai) {
      vi.mocked(window.openai.sendFollowUpMessage!).mockRejectedValueOnce(new Error("rejected"));
    }
    const { askChatGpt } = await import("./host.js");

    await expect(askChatGpt("再试一次", { scrollToBottom: false })).resolves.toBe(true);
    expect(bridge.sendMessage).toHaveBeenCalledWith({
      role: "user",
      content: [{ type: "text", text: "再试一次" }]
    });
  });

  it("samples Daddy text through the host model connection", async () => {
    bridge.createSamplingMessage.mockResolvedValueOnce({
      role: "assistant",
      model: "host-model",
      stopReason: "endTurn",
      content: { type: "text", text: "  这句真会拱火。  " }
    });
    const { sampleChatGptText } = await import("./host.js");

    await expect(
      sampleChatGptText("点评这一段", {
        systemPrompt: "你是Daddy。",
        maxTokens: 80,
        temperature: 0.8
      })
    ).resolves.toBe("这句真会拱火。");
    expect(bridge.createSamplingMessage).toHaveBeenCalledWith(
      {
        messages: [
          { role: "user", content: { type: "text", text: "点评这一段" } }
        ],
        maxTokens: 80,
        includeContext: "thisServer",
        systemPrompt: "你是Daddy。",
        temperature: 0.8
      },
      { timeout: 12_000, maxTotalTimeout: 12_000 }
    );
  });

  it("starts the direct ChatGPT fullscreen request in the user gesture call stack", async () => {
    const requestDisplayMode = vi.fn().mockResolvedValue(undefined);
    if (window.openai) window.openai.requestDisplayMode = requestDisplayMode;
    const { requestReaderFullscreen } = await import("./host.js");

    const result = requestReaderFullscreen();

    expect(requestDisplayMode).toHaveBeenCalledWith({ mode: "fullscreen" });
    expect(bridge.requestDisplayMode).not.toHaveBeenCalled();
    await expect(result).resolves.toBe(true);
  });

  it("stores and restores only lightweight reader widget state", async () => {
    const { initialWidgetState, saveReaderWidgetState } = await import("./host.js");
    const state = {
      screen: "novel" as const,
      sessionId: "session-1",
      positionIndex: 3,
      scrollTop: 240
    };

    saveReaderWidgetState(state);

    expect(window.openai?.setWidgetState).toHaveBeenCalledWith(state);
    expect(initialWidgetState()).toEqual({
      screen: "novel",
      sessionId: "session-1",
      positionIndex: 2,
      scrollTop: 120
    });
  });
});
