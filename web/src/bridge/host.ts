import { App as McpApp } from "@modelcontextprotocol/ext-apps";
import {
  publishCompanionCommentInputSchema,
  replyToAnnotationInputSchema
} from "@ss/shared";
import type { ToolCallResult } from "../types/openai.js";

let app: McpApp | undefined;
let appReady: Promise<boolean> | undefined;
let appConnectionFailed = false;
let lastReaderWidgetState: ReaderWidgetState | undefined;
let compatibilityModelContent: string | undefined;
let compatibilityStateHost: Window["openai"] | undefined;

const APP_HANDSHAKE_TIMEOUT_MS = 2_000;

export const LIVE_READING_WRITEBACK_TOOL = "submit_live_reading_comment_v58";
export const LEGACY_LIVE_READING_WRITEBACK_TOOL = "submit_live_reading_comment_v39";
export const ANNOTATION_WRITEBACK_TOOL = "submit_annotation_reply_v39";

type LiveReadingWritebackExpectation = {
  sessionId: string;
  position: {
    kind: string;
    index: number;
    label: string;
    total?: number;
  };
  mode: string;
  length: string;
  source: "live_reading";
  operationId: string;
};

const stagedLiveReadingWritebacks = new Map<string, LiveReadingWritebackExpectation>();
const MAX_STAGED_LIVE_READING_WRITEBACKS = 12;

export function stageLiveReadingWriteback(
  expected: LiveReadingWritebackExpectation
): void {
  stagedLiveReadingWritebacks.set(expected.operationId, {
    ...expected,
    position: { ...expected.position }
  });
  while (stagedLiveReadingWritebacks.size > MAX_STAGED_LIVE_READING_WRITEBACKS) {
    const oldestOperationId = stagedLiveReadingWritebacks.keys().next().value;
    if (typeof oldestOperationId !== "string") break;
    stagedLiveReadingWritebacks.delete(oldestOperationId);
  }
}

async function forwardLiveReadingWriteback(
  bridge: McpApp,
  args: Record<string, unknown>
) {
  const submittedPosition = args.position as
    | { kind?: unknown; index?: unknown }
    | undefined;
  const expected = [...stagedLiveReadingWritebacks.values()].find(
    (candidate) =>
      args.sessionId === candidate.sessionId &&
      submittedPosition?.kind === candidate.position.kind &&
      submittedPosition.index === candidate.position.index
  );
  if (!expected) {
    if (stagedLiveReadingWritebacks.size > 0) {
      throw new Error("Rejected a stale live-reading writeback for another position.");
    }
    throw new Error("No live-reading writeback is currently pending.");
  }
  if (
    args.sessionId !== expected.sessionId ||
    submittedPosition?.kind !== expected.position.kind ||
    submittedPosition.index !== expected.position.index
  ) {
    throw new Error("Rejected a stale live-reading writeback for another position.");
  }
  if (typeof args.text !== "string" || !args.text.trim()) {
    throw new Error("The live-reading comment text is empty.");
  }
  const result = await bridge.callServerTool({
    name: "publish_companion_comment",
    arguments: {
      ...args,
      ...expected,
      position: { ...expected.position },
      text: args.text
    }
  });
  stagedLiveReadingWritebacks.delete(expected.operationId);
  return result;
}

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
      { name: "S×S 小窝共读", version: "0.4.7" },
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
    // Follow-up turns created from iOS/iPadOS can start reasoning without
    // exposing the server's mutation tools to that turn. Advertise two tiny
    // app-owned writeback tools as well. The host model can submit generated
    // text to the live iframe, and the iframe forwards it to the canonical
    // server tool so storage and idempotency remain unchanged.
    for (const toolName of [
      LIVE_READING_WRITEBACK_TOOL,
      LEGACY_LIVE_READING_WRITEBACK_TOOL
    ]) {
      nextApp.registerTool(
        toolName,
        {
          title: "写回小窝实时陪读短评",
          description:
            "Use this for a live-reading request sent by the S×S reading widget. The widget validates the pending chapter and fixes all routing arguments before saving.",
          inputSchema: publishCompanionCommentInputSchema
        },
        async (args) => forwardLiveReadingWriteback(nextApp, args)
      );
    }
    nextApp.registerTool(
      ANNOTATION_WRITEBACK_TOOL,
      {
        title: "写回小窝划线回复",
        description:
          "Use this for an annotation-reply request sent by the S×S reading widget. Submit the final reply with the exact fixed arguments from the request.",
        inputSchema: replyToAnnotationInputSchema
      },
      async (args) => nextApp.callServerTool({
        name: "reply_to_annotation_v23",
        arguments: args
      })
    );
    app = nextApp;
    appReady = Promise.resolve()
      .then(() => nextApp.connect())
      .then(
        () => true,
        () => {
          if (app === nextApp) appConnectionFailed = true;
          return false;
        }
      );
  }
  return app;
}

async function waitForConnectedApp(bridge: McpApp): Promise<boolean> {
  const readyPromise = appReady;
  if (!readyPromise) return false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const ready = await Promise.race([
      readyPromise,
      new Promise<false>((resolve) => {
        timer = setTimeout(() => resolve(false), APP_HANDSHAKE_TIMEOUT_MS);
      })
    ]);
    if (!ready && app === bridge) {
      // A mobile host can leave the handshake pending forever instead of
      // rejecting it. Treat the timeout as a failed connection so the next
      // attempt builds a fresh bridge rather than reusing the stuck promise.
      appConnectionFailed = true;
    }
    return ready && app === bridge && !appConnectionFailed;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export async function setReadingFrameHeight(height: number): Promise<boolean> {
  const bridge = connectApp();
  if (!bridge) return false;
  if (!(await waitForConnectedApp(bridge))) return false;
  try {
    await bridge.sendSizeChanged({ height: Math.max(72, Math.round(height)) });
    return true;
  } catch {
    return false;
  }
}

export async function callAppServerTool(
  name: string,
  args: Record<string, unknown>
): Promise<ToolCallResult> {
  const bridge = connectApp();
  if (!bridge || !(await waitForConnectedApp(bridge))) {
    throw new Error("MCP Apps bridge is not connected");
  }
  return (await bridge.callServerTool({ name, arguments: args })) as ToolCallResult;
}

export async function callTool(
  name: string,
  args: Record<string, unknown>
): Promise<ToolCallResult> {
  const bridge = connectApp();
  if (bridge) {
    if (await waitForConnectedApp(bridge)) {
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
  options: {
    scrollToBottom?: boolean;
    transport?: "auto" | "apps" | "compatibility" | "compatibility-first";
  } = {}
): Promise<boolean> {
  const transport = options.transport ?? "auto";
  if (transport === "compatibility-first") {
    if (await sendCompatibilityMessage(prompt, options.scrollToBottom)) return true;
    return sendAppMessage(prompt);
  }
  // Prefer the standard MCP Apps request. Unlike the legacy compatibility
  // alias, ui/message returns an acknowledgement with an isError flag. That
  // acknowledgement still only proves host acceptance, not that an app-owned
  // writeback completed. Callers that verify a writeback can explicitly retry
  // the alternate ChatGPT compatibility transport after a false-positive ACK.
  if (transport !== "compatibility") {
    if (await sendAppMessage(prompt)) return true;
    // If the iframe won a startup race against the mobile host, reconnect and
    // retry the same tap once instead of making the user discover it manually.
    if (appConnectionFailed && await sendAppMessage(prompt)) return true;
    if (transport === "apps") return false;
  }
  return sendCompatibilityMessage(prompt, options.scrollToBottom);
}

async function sendCompatibilityMessage(
  prompt: string,
  scrollToBottom = false
): Promise<boolean> {
  if (!window.openai?.sendFollowUpMessage) return false;
  try {
    // iOS compatibility hosts can snapshot widget state when the follow-up is
    // created. Re-assert the model-visible payload in the same call stack so a
    // later reader-state save cannot leave that follow-up without its正文.
    persistCompatibilityModelContext();
    await window.openai.sendFollowUpMessage({ prompt, scrollToBottom });
    return true;
  } catch {
    return false;
  }
}

export function sendFollowUpFromUserGesture(
  prompt: string,
  scrollToBottom = false,
  modelContext?: Record<string, unknown>
): Promise<boolean> {
  if (!window.openai?.sendFollowUpMessage) return Promise.resolve(false);
  if (modelContext) {
    // A chapter change must replace the compatibility payload before the host
    // snapshots widget state for this exact gesture. Waiting for the async Apps
    // bridge here would let the previous chapter leak into the new follow-up.
    refreshCompatibilityHostBoundary();
    compatibilityModelContent = JSON.stringify(modelContext);
  }
  try {
    // Keep this host call synchronous with the originating tap. In particular,
    // do not await the MCP Apps handshake or a server tool first: mobile hosts
    // can discard a component-authored follow-up once user activation expires.
    persistCompatibilityModelContext();
    return window.openai
      .sendFollowUpMessage({ prompt, scrollToBottom })
      .then(() => true, () => false);
  } catch {
    return Promise.resolve(false);
  }
}

async function sendAppMessage(prompt: string): Promise<boolean> {
  const bridge = connectApp();
  if (!bridge) return false;
  if (!(await waitForConnectedApp(bridge))) return false;
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
  if (
    !(await waitForConnectedApp(bridge)) ||
    !bridge.getHostCapabilities()?.sampling
  ) return null;
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
  if (
    !(await waitForConnectedApp(bridge)) ||
    !bridge.getHostCapabilities()?.sampling?.tools
  ) return null;
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
      if (!(await waitForConnectedApp(bridge))) return false;
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
  refreshCompatibilityHostBoundary();
  const serialized = JSON.stringify(context);
  const bridge = connectApp();
  if (bridge) {
    try {
      if (await waitForConnectedApp(bridge)) {
        await bridge.updateModelContext({
          content: [{ type: "text", text: serialized }]
        });
        return true;
      }
    } catch {
      // Older iOS hosts expose setWidgetState/sendFollowUpMessage without a
      // working MCP Apps handshake. Preserve the same context there below.
    }
  }
  compatibilityModelContent = serialized;
  return persistCompatibilityModelContext();
}

export async function requestReaderFullscreen(): Promise<boolean> {
  try {
    if (window.openai?.requestDisplayMode) {
      await window.openai.requestDisplayMode({ mode: "fullscreen" });
      return true;
    }
    const bridge = connectApp();
    if (bridge) {
      if (!(await waitForConnectedApp(bridge))) return false;
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
      if (!(await waitForConnectedApp(bridge))) return false;
      const result = await bridge.requestDisplayMode({ mode: "inline" });
      return result.mode === "inline";
    }
  } catch {
    return false;
  }
  return false;
}

export function saveReaderWidgetState(state: ReaderWidgetState) {
  refreshCompatibilityHostBoundary();
  lastReaderWidgetState = state;
  if (compatibilityModelContent) {
    persistCompatibilityModelContext();
    return;
  }
  window.openai?.setWidgetState?.(state);
}

export function initialWidgetState(): ReaderWidgetState | undefined {
  refreshCompatibilityHostBoundary();
  const state = unwrapReaderWidgetState(window.openai?.widgetState);
  lastReaderWidgetState = state;
  return state;
}

function persistCompatibilityModelContext(): boolean {
  refreshCompatibilityHostBoundary();
  if (!compatibilityModelContent || !window.openai?.setWidgetState) return false;
  const current = lastReaderWidgetState ?? unwrapReaderWidgetState(window.openai.widgetState);
  try {
    window.openai.setWidgetState({
      modelContent: compatibilityModelContent,
      ...(current ? { privateContent: current } : {})
    });
    return true;
  } catch {
    return false;
  }
}

function refreshCompatibilityHostBoundary() {
  if (compatibilityStateHost && compatibilityStateHost !== window.openai) {
    compatibilityModelContent = undefined;
    lastReaderWidgetState = undefined;
  }
  compatibilityStateHost = window.openai;
}

function unwrapReaderWidgetState(
  state: ReaderWidgetState | ReaderWidgetEnvelope | undefined
): ReaderWidgetState | undefined {
  if (!state) return undefined;
  return "screen" in state ? state : state.privateContent;
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
    void waitForConnectedApp(bridge).then((ready) => {
      if (ready) listener((bridge.getHostContext() ?? {}) as ReadingHostContext);
    });
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
