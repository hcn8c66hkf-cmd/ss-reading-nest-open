import { App as McpApp } from "@modelcontextprotocol/ext-apps";
import type { ToolCallResult } from "../types/openai.js";

let app: McpApp | undefined;
let appReady: Promise<boolean> | undefined;
let appConnectionFailed = false;

export interface ReadingHostContext {
  displayMode?: "inline" | "pip" | "fullscreen";
  availableDisplayModes?: Array<"inline" | "pip" | "fullscreen">;
  containerDimensions?: {
    width?: number;
    maxWidth?: number;
    height?: number;
    maxHeight?: number;
  };
  safeAreaInsets?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

function connectApp() {
  if (typeof window === "undefined" || window.parent === window) return undefined;
  // Mobile WebViews can render the iframe before the host finishes installing
  // its message listener. Do not make one early handshake failure permanent.
  if (appConnectionFailed) {
    app = undefined;
    appReady = undefined;
    appConnectionFailed = false;
  }
  if (!app) {
    const nextApp = new McpApp(
      { name: "S×S 小窝共读", version: "0.3.8" },
      {},
      {
        // The SDK's default ResizeObserver briefly sets <html> to max-content
        // while measuring it. In ChatGPT's inline cards that can feed the host's
        // newly assigned iframe height back into the next measurement and make
        // an otherwise empty card grow forever. The reader has a bounded inner
        // viewport, so report that stable height explicitly instead.
        autoResize: false
      }
    );
    app = nextApp;
    appReady = nextApp.connect().then(
      () => true,
      () => {
        if (app === nextApp) appConnectionFailed = true;
        return false;
      }
    );
  }
  return app;
}

export async function setReadingFrameHeight(height: number): Promise<boolean> {
  const bridge = connectApp();
  if (!bridge) return false;
  const ready = await appReady;
  if (!ready || appConnectionFailed) return false;
  try {
    await bridge.sendSizeChanged({ height: Math.max(72, Math.round(height)) });
    return true;
  } catch {
    return false;
  }
}

export async function callTool(
  name: string,
  args: Record<string, unknown>
): Promise<ToolCallResult> {
  const bridge = connectApp();
  if (bridge) {
    const ready = await appReady;
    if (ready && !appConnectionFailed) {
      try {
        return (await bridge.callServerTool({ name, arguments: args })) as ToolCallResult;
      } catch {
        // Older ChatGPT hosts may connect to the shared Apps bridge without
        // proxying server tools. Try the compatibility API below.
      }
    }
  }
  if (window.openai?.callTool) return window.openai.callTool(name, args);
  return { structuredContent: {} };
}

export async function askChatGpt(
  prompt: string,
  options: { scrollToBottom?: boolean } = {}
): Promise<boolean> {
  // Prefer the standard MCP Apps request. Unlike the legacy compatibility
  // alias, ui/message returns an acknowledgement with an isError flag. Some
  // iOS/iPadOS hosts expose sendFollowUpMessage but resolve it without actually
  // starting a conversation turn, which previously looked like a successful
  // delivery and prevented this reliable path from running.
  if (await sendAppMessage(prompt)) return true;
  // If the iframe won a startup race against the mobile host, reconnect and
  // retry the same tap once instead of making the user discover it manually.
  if (appConnectionFailed && await sendAppMessage(prompt)) return true;
  if (window.openai?.sendFollowUpMessage) {
    try {
      await window.openai.sendFollowUpMessage({
        prompt,
        scrollToBottom: options.scrollToBottom ?? false
      });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

async function sendAppMessage(prompt: string): Promise<boolean> {
  const bridge = connectApp();
  if (!bridge) return false;
  const ready = await appReady;
  if (!ready || appConnectionFailed) return false;
  try {
    const result = await bridge.sendMessage({
      role: "user",
      content: [{ type: "text", text: prompt }]
    });
    return !result?.isError;
  } catch {
    return false;
  }
}

export async function sampleChatGptText(
  prompt: string,
  options: {
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
  } = {}
): Promise<string | null> {
  const bridge = connectApp();
  if (!bridge) return null;
  const ready = await appReady;
  if (!ready || appConnectionFailed || !bridge.getHostCapabilities()?.sampling) return null;
  try {
    const result = await bridge.createSamplingMessage({
      messages: [
        {
          role: "user",
          content: { type: "text", text: prompt }
        }
      ],
      maxTokens: options.maxTokens ?? 220,
      includeContext: "thisServer",
      ...(options.systemPrompt ? { systemPrompt: options.systemPrompt } : {}),
      ...(options.temperature === undefined
        ? {}
        : { temperature: options.temperature })
    });
    return samplingText(result);
  } catch {
    return null;
  }
}

export async function sampleChatGptToolInput(
  prompt: string,
  tool: {
    name: string;
    description?: string;
    inputSchema: {
      type: "object";
      properties?: Record<string, object>;
      required?: string[];
    };
  },
  options: {
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
  } = {}
): Promise<Record<string, unknown> | null> {
  const bridge = connectApp();
  if (!bridge) return null;
  const ready = await appReady;
  if (!ready || appConnectionFailed || !bridge.getHostCapabilities()?.sampling?.tools) return null;
  try {
    const result = await bridge.createSamplingMessage({
      messages: [
        {
          role: "user",
          content: { type: "text", text: prompt }
        }
      ],
      maxTokens: options.maxTokens ?? 1_200,
      includeContext: "thisServer",
      tools: [tool],
      toolChoice: { mode: "required" },
      ...(options.systemPrompt ? { systemPrompt: options.systemPrompt } : {}),
      ...(options.temperature === undefined
        ? {}
        : { temperature: options.temperature })
    });
    return samplingToolInput(result, tool.name);
  } catch {
    return null;
  }
}

function samplingText(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const content = (result as { content?: unknown }).content;
  const blocks = Array.isArray(content) ? content : [content];
  const text = blocks
    .filter(
      (block): block is { type: "text"; text: string } =>
        !!block &&
        typeof block === "object" &&
        (block as { type?: unknown }).type === "text" &&
        typeof (block as { text?: unknown }).text === "string"
    )
    .map((block) => block.text)
    .join("\n")
    .trim();
  return text || null;
}

function samplingToolInput(
  result: unknown,
  toolName: string
): Record<string, unknown> | null {
  if (!result || typeof result !== "object") return null;
  const content = (result as { content?: unknown }).content;
  const blocks = Array.isArray(content) ? content : [content];
  const toolUse = blocks.find(
    (block): block is { type: "tool_use"; name: string; input: Record<string, unknown> } =>
      !!block &&
      typeof block === "object" &&
      (block as { type?: unknown }).type === "tool_use" &&
      (block as { name?: unknown }).name === toolName &&
      !!(block as { input?: unknown }).input &&
      typeof (block as { input?: unknown }).input === "object" &&
      !Array.isArray((block as { input?: unknown }).input)
  );
  return toolUse?.input ?? null;
}

export async function requestReaderPip(): Promise<boolean> {
  const bridge = connectApp();
  try {
    if (bridge) {
      const ready = await appReady;
      if (!ready || appConnectionFailed) return false;
      const result = await bridge.requestDisplayMode({ mode: "pip" });
      return result.mode === "pip";
    }
    if (window.openai?.requestDisplayMode) {
      await window.openai.requestDisplayMode({ mode: "pip" });
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export async function updateModelContext(context: Record<string, unknown>): Promise<boolean> {
  const bridge = connectApp();
  if (!bridge) return false;
  try {
    const ready = await appReady;
    if (!ready || appConnectionFailed) return false;
    await bridge.updateModelContext({
      content: [{ type: "text", text: JSON.stringify(context) }]
    });
    return true;
  } catch {
    return false;
  }
}

export async function requestReaderFullscreen(): Promise<boolean> {
  try {
    if (window.openai?.requestDisplayMode) {
      await window.openai.requestDisplayMode({ mode: "fullscreen" });
      return true;
    }
    const bridge = connectApp();
    if (bridge) {
      const ready = await appReady;
      if (!ready || appConnectionFailed) return false;
      const result = await bridge.requestDisplayMode({ mode: "fullscreen" });
      return result.mode === "fullscreen";
    }
  } catch {
    return false;
  }
  return false;
}

export async function requestReaderInline(): Promise<boolean> {
  try {
    if (window.openai?.requestDisplayMode) {
      await window.openai.requestDisplayMode({ mode: "inline" });
      return true;
    }
    const bridge = connectApp();
    if (bridge) {
      const ready = await appReady;
      if (!ready || appConnectionFailed) return false;
      const result = await bridge.requestDisplayMode({ mode: "inline" });
      return result.mode === "inline";
    }
  } catch {
    return false;
  }
  return false;
}

export function saveReaderWidgetState(state: ReaderWidgetState) {
  window.openai?.setWidgetState?.(state);
}

export function initialWidgetState(): ReaderWidgetState | undefined {
  return window.openai?.widgetState;
}

export function initialToolOutput<T>(): T | undefined {
  return window.openai?.toolOutput as T | undefined;
}

export function subscribeHostContext(
  listener: (context: ReadingHostContext) => void
): () => void {
  const legacyListener = (event: Event) => {
    listener((event as CustomEvent<ReadingHostContext>).detail ?? {});
  };
  window.addEventListener("openai:host-context-changed", legacyListener);

  const bridge = connectApp();
  const bridgeListener = (context: ReadingHostContext) => listener(context);
  if (bridge) {
    bridge.addEventListener("hostcontextchanged", bridgeListener);
    void appReady?.then(() => listener((bridge.getHostContext() ?? {}) as ReadingHostContext));
  } else if (window.openai?.hostContext) {
    listener(window.openai.hostContext);
  }

  return () => {
    window.removeEventListener("openai:host-context-changed", legacyListener);
    bridge?.removeEventListener("hostcontextchanged", bridgeListener);
  };
}

export const fileCapabilities = {
  uploadFile: () => window.openai?.uploadFile,
  selectFiles: () => window.openai?.selectFiles,
  getFileDownloadUrl: () => window.openai?.getFileDownloadUrl
};
