import { App as McpApp } from "@modelcontextprotocol/ext-apps";
import type { ToolCallResult } from "../types/openai.js";

let app: McpApp | undefined;
let appReady: Promise<void> | undefined;
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
  if (!app) {
    app = new McpApp({ name: "S×S 小窝共读", version: "0.3.0" });
    appReady = app.connect().catch(() => {
      appConnectionFailed = true;
    });
  }
  return app;
}

export async function callTool(
  name: string,
  args: Record<string, unknown>
): Promise<ToolCallResult> {
  const bridge = connectApp();
  if (bridge) {
    await appReady;
    if (!appConnectionFailed) {
      return (await bridge.callServerTool({ name, arguments: args })) as ToolCallResult;
    }
  }
  if (window.openai?.callTool) return window.openai.callTool(name, args);
  return { structuredContent: {} };
}

export async function askChatGpt(
  prompt: string,
  options: { scrollToBottom?: boolean } = {}
): Promise<boolean> {
  if (window.openai?.sendFollowUpMessage) {
    try {
      await window.openai.sendFollowUpMessage({
        prompt,
        scrollToBottom: options.scrollToBottom ?? false
      });
      return true;
    } catch {
      // Fall through to the shared Apps bridge. Some mobile ChatGPT hosts expose
      // the compatibility alias but may reject an individual delivery attempt.
    }
  }
  const bridge = connectApp();
  if (bridge) {
    await appReady;
    if (!appConnectionFailed) {
      try {
        await bridge.sendMessage({ role: "user", content: [{ type: "text", text: prompt }] });
        return true;
      } catch {
        // Fall through to the ChatGPT compatibility alias when the shared bridge
        // is present but this host rejects ui/message.
      }
    }
  }
  return false;
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
  await appReady;
  if (appConnectionFailed || !bridge.getHostCapabilities()?.sampling) return null;
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

export async function requestReaderPip(): Promise<boolean> {
  const bridge = connectApp();
  try {
    if (bridge) {
      await appReady;
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
    await appReady;
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
      await appReady;
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
      await appReady;
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
