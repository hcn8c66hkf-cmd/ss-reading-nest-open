import { beforeEach, describe, expect, it, vi } from "vitest";

const bridge = {
  connect: vi.fn().mockResolvedValue(undefined),
  callServerTool: vi.fn(),
  sendMessage: vi.fn().mockResolvedValue({}),
  getHostCapabilities: vi.fn().mockReturnValue({ sampling: {} }),
  createSamplingMessage: vi.fn(),
  updateModelContext: vi.fn().mockResolvedValue({}),
  requestDisplayMode: vi.fn().mockResolvedValue({ mode: "fullscreen" }),
  sendSizeChanged: vi.fn().mockResolvedValue(undefined)
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
    sendSizeChanged = bridge.sendSizeChanged;
  }
}));

describe("host bridge", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    bridge.connect.mockResolvedValue(undefined);
    bridge.sendMessage.mockResolvedValue({});
    Object.defineProperty(window, "parent", {
      configurable: true,
      value: {}
    });
    Object.defineProperty(window, "openai", {
      configurable: true,
      value: {
        setWidgetState: vi.fn(),
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

  it("requests fullscreen and sends a message without forcing chat scroll", async () => {
    const { askChatGpt, requestReaderFullscreen } = await import("./host.js");

    await expect(requestReaderFullscreen()).resolves.toBe(true);
    await askChatGpt("陪我看看这里", { scrollToBottom: false });

    expect(bridge.requestDisplayMode).toHaveBeenCalledWith({ mode: "fullscreen" });
    expect(bridge.sendMessage).toHaveBeenCalledWith({
      role: "user",
      content: [{ type: "text", text: "陪我看看这里" }]
    });
  });

  it("prefers the acknowledged Apps message path even when a mobile compatibility alias exists", async () => {
    const sendFollowUpMessage = vi.fn().mockResolvedValue(undefined);
    if (window.openai) window.openai.sendFollowUpMessage = sendFollowUpMessage;
    const { askChatGpt } = await import("./host.js");

    await expect(askChatGpt("请读手机上的这一段", { scrollToBottom: false })).resolves.toBe(true);

    expect(bridge.sendMessage).toHaveBeenCalledWith({
      role: "user",
      content: [{ type: "text", text: "请读手机上的这一段" }]
    });
    expect(sendFollowUpMessage).not.toHaveBeenCalled();
  });

  it("falls back to the compatibility alias when the Apps host rejects delivery", async () => {
    bridge.sendMessage.mockResolvedValueOnce({ isError: true });
    const sendFollowUpMessage = vi.fn().mockResolvedValue(undefined);
    if (window.openai) window.openai.sendFollowUpMessage = sendFollowUpMessage;
    const { askChatGpt } = await import("./host.js");

    await expect(askChatGpt("换一条路送达")).resolves.toBe(true);

    expect(bridge.sendMessage).toHaveBeenCalledWith({
      role: "user",
      content: [{ type: "text", text: "换一条路送达" }]
    });
    expect(sendFollowUpMessage).toHaveBeenCalledWith({
      prompt: "换一条路送达",
      scrollToBottom: false
    });
  });

  it("retries the Apps handshake after an early mobile connection failure", async () => {
    bridge.connect.mockRejectedValueOnce(new Error("host listener not ready"));
    const { askChatGpt } = await import("./host.js");

    await expect(askChatGpt("同一次点击自动重试")).resolves.toBe(true);

    expect(bridge.connect).toHaveBeenCalledTimes(2);
    expect(bridge.sendMessage).toHaveBeenCalledWith({
      role: "user",
      content: [{ type: "text", text: "同一次点击自动重试" }]
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
    expect(bridge.createSamplingMessage).toHaveBeenCalledWith({
      messages: [
        { role: "user", content: { type: "text", text: "点评这一段" } }
      ],
      maxTokens: 80,
      includeContext: "thisServer",
      systemPrompt: "你是Daddy。",
      temperature: 0.8
    });
  });

  it("samples strict structured input through a required host tool", async () => {
    bridge.getHostCapabilities.mockReturnValueOnce({ sampling: { tools: {} } });
    bridge.createSamplingMessage.mockResolvedValueOnce({
      role: "assistant",
      model: "host-model",
      stopReason: "toolUse",
      content: [
        {
          type: "tool_use",
          id: "tool-1",
          name: "submit_verdict",
          input: { verdict: "knowledge_only", title: "人物观察" }
        }
      ]
    });
    const { sampleChatGptToolInput } = await import("./host.js");
    const tool = {
      name: "submit_verdict",
      description: "Submit a verdict",
      inputSchema: {
        type: "object" as const,
        properties: { verdict: { type: "string" } },
        required: ["verdict"]
      }
    };

    await expect(
      sampleChatGptToolInput("评估这一章", tool, {
        systemPrompt: "只调用工具。",
        maxTokens: 500,
        temperature: 0
      })
    ).resolves.toEqual({ verdict: "knowledge_only", title: "人物观察" });
    expect(bridge.createSamplingMessage).toHaveBeenCalledWith({
      messages: [
        { role: "user", content: { type: "text", text: "评估这一章" } }
      ],
      maxTokens: 500,
      includeContext: "thisServer",
      tools: [tool],
      toolChoice: { mode: "required" },
      systemPrompt: "只调用工具。",
      temperature: 0
    });
  });

  it("does not request a structured tool when the host lacks tool sampling", async () => {
    bridge.getHostCapabilities.mockReturnValueOnce({ sampling: {} });
    const { sampleChatGptToolInput } = await import("./host.js");

    await expect(
      sampleChatGptToolInput("评估这一章", {
        name: "submit_verdict",
        inputSchema: { type: "object" }
      })
    ).resolves.toBeNull();
    expect(bridge.createSamplingMessage).not.toHaveBeenCalled();
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

  it("disables SDK auto-resize and reports one bounded frame height explicitly", async () => {
    const { setReadingFrameHeight } = await import("./host.js");

    await expect(setReadingFrameHeight(683.6)).resolves.toBe(true);

    expect(bridge.sendSizeChanged).toHaveBeenCalledWith({ height: 684 });
  });
});
