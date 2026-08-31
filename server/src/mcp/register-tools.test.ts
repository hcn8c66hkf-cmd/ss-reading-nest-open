import { describe, expect, it } from "vitest";
import {
  buildCurrentReadingContext,
  buildModelReadableCurrentContext,
  READING_NEST_TOOL_NAME,
  READING_NEST_URI,
  registerReadingTools,
  TOOL_CONFIGS
} from "./register-tools.js";

describe("tool descriptors", () => {
  it("binds the current UI resource to the v44 and compatibility render tools", () => {
    expect(READING_NEST_URI).toBe("ui://ss-reading-nest/app-v44.html");
    expect(READING_NEST_TOOL_NAME).toBe("open_reading_nest_v44");
    expect(TOOL_CONFIGS.open_reading_nest_v44._meta?.ui).toEqual({
      resourceUri: READING_NEST_URI
    });
    expect(TOOL_CONFIGS.open_reading_nest_v44._meta?.["ui/resourceUri"]).toBe(
      READING_NEST_URI
    );
    expect(TOOL_CONFIGS.open_reading_nest_v44._meta?.["openai/outputTemplate"]).toBe(
      READING_NEST_URI
    );
    expect(TOOL_CONFIGS.open_reading_nest._meta?.["openai/outputTemplate"]).toBe(
      READING_NEST_URI
    );
    for (const [name, config] of Object.entries(TOOL_CONFIGS)) {
      if (
        name !== "open_reading_nest_v44" &&
        name !== "open_reading_nest_v43" &&
        name !== "open_reading_nest_v42" &&
        name !== "open_reading_nest_v41" &&
        name !== "open_reading_nest_v40" &&
        name !== "open_reading_nest_v39" &&
        name !== "open_reading_nest_v37" &&
        name !== "open_reading_nest_v36" &&
        name !== "open_reading_nest_v35" &&
        name !== "open_reading_nest_v34" &&
        name !== "open_reading_nest_v33" &&
        name !== "open_reading_nest_v32" &&
        name !== "open_reading_nest_v31" &&
        name !== "open_reading_nest_v30" &&
        name !== "open_reading_nest_v29" &&
        name !== "open_reading_nest_v28" &&
        name !== "open_reading_nest_v27" &&
        name !== "open_reading_nest_v26" &&
        name !== "open_reading_nest_v25" &&
        name !== "open_reading_nest_v24" &&
        name !== "open_reading_nest_v23" &&
        name !== "open_reading_nest_v22" &&
        name !== "open_reading_nest" &&
        name !== "upload_cloud_source" &&
        name !== "create_annotation_v23" &&
        name !== "reply_to_annotation_v23" &&
        name !== "list_annotations_v23" &&
        name !== "set_annotation_favorite" &&
        name !== "list_annotation_favorites"
      ) {
        const meta = "_meta" in config ? (config._meta as Record<string, unknown>) : undefined;
        expect(meta?.ui).toBeUndefined();
      }
    }
    expect(TOOL_CONFIGS.upload_cloud_source._meta.ui).toEqual({
      visibility: ["app"]
    });
    for (const name of [
      "create_annotation_v23",
      "reply_to_annotation_v23",
      "list_annotations_v23",
      "set_annotation_favorite",
      "list_annotation_favorites"
    ] as const) {
      expect(TOOL_CONFIGS[name]._meta.ui).toEqual({ visibility: ["app"] });
    }
  });

  it("returns the component-only source endpoint for the rendered widget", async () => {
    const handlers = new Map<string, () => Promise<unknown>>();
    const configs = new Map<string, any>();
    const server = {
      registerTool: (name: string, config: unknown, handler: () => Promise<unknown>) => {
        configs.set(name, config);
        handlers.set(name, handler);
      }
    };
    const service = {
      listAllSessions: async () => [
        {
          id: "session-1",
          title: "云端书",
          type: "novel",
          status: "active",
          userCurrentPosition: { kind: "paragraph", index: 1, label: "第 1 段" },
          assistantSyncedPosition: null,
          liveReadingEnabled: false,
          sessionPreferences: {},
          sourceManifest: null,
          createdAt: "2026-06-24T00:00:00.000Z",
          updatedAt: "2026-06-24T00:00:00.000Z",
          lastReadAt: "2026-06-24T00:00:00.000Z"
        }
      ],
      getSessionBundle: async () => ({
        session: {
          id: "session-1",
          title: "云端书",
          type: "novel",
          status: "active",
          userCurrentPosition: { kind: "paragraph", index: 1, label: "第 1 段" },
          assistantSyncedPosition: null,
          liveReadingEnabled: false,
          sessionPreferences: {},
          sourceManifest: null,
          createdAt: "2026-06-24T00:00:00.000Z",
          updatedAt: "2026-06-24T00:00:00.000Z",
          lastReadAt: "2026-06-24T00:00:00.000Z"
        },
        quotes: [],
        reactions: [],
        bookmarks: []
      }),
      listAnnotations: async () => ({ annotations: [] }),
      listCompanionComments: async () => ({ comments: [] })
    };

    registerReadingTools(server as never, service as never, undefined, {
      sourceEndpointBase: "https://worker.example.test/source/secret"
    });
    const result = (await handlers.get("open_reading_nest_v44")?.()) as {
      structuredContent?: Record<string, unknown>;
    };

    expect(result.structuredContent?.sourceEndpointBase).toBe(
      "https://worker.example.test/source/secret"
    );
    expect(JSON.stringify(result)).not.toMatch(/sourceText|bytesBase64|data:image/);
    expect(handlers.has("open_reading_nest")).toBe(true);
    expect(handlers.has("open_reading_nest_v23")).toBe(true);
    expect(handlers.has("open_reading_nest_v22")).toBe(true);
    expect(configs.get("open_reading_nest_v36")._meta).toMatchObject({
      ui: { resourceUri: READING_NEST_URI },
      "ui/resourceUri": READING_NEST_URI,
      "openai/outputTemplate": READING_NEST_URI
    });
  });

  it("preloads the exact current paragraph and comments through the stale generic open entry", async () => {
    const handlers = new Map<string, (args?: any) => Promise<any>>();
    const server = {
      registerTool: (name: string, _config: unknown, handler: (args?: any) => Promise<any>) => {
        handlers.set(name, handler);
      }
    };
    const session = {
      id: "session-generic-preload",
      title: "手机旧目录里的书",
      type: "novel",
      status: "active",
      userCurrentPosition: { kind: "paragraph", index: 2, label: "第 2 段" },
      assistantSyncedPosition: null,
      liveReadingEnabled: true,
      sessionPreferences: { autoSaveCompanionComments: true },
      sourceManifest: null,
      createdAt: "2026-08-30T00:00:00.000Z",
      updatedAt: "2026-08-30T00:00:00.000Z",
      lastReadAt: "2026-08-30T00:00:00.000Z"
    };
    const staleFirstSession = {
      ...session,
      id: "session-stale-first",
      title: "书架排第一但不是刚读的书",
      userCurrentPosition: { kind: "paragraph", index: 1, label: "第 1 段" },
      updatedAt: "2026-08-29T00:00:00.000Z"
    };
    const annotation = {
      id: "annotation-preload",
      sessionId: session.id,
      position: session.userCurrentPosition,
      anchor: { selectedText: "这句" },
      createdBy: "user",
      messages: [
        {
          id: "message-preload",
          author: "user",
          text: "Daddy收到这条了吗",
          createdAt: "2026-08-30T00:01:00.000Z"
        }
      ],
      createdAt: "2026-08-30T00:01:00.000Z",
      updatedAt: "2026-08-30T00:01:00.000Z"
    };
    const service = {
      listAllSessions: async () => [staleFirstSession, session],
      getSessionBundle: async (sessionId: string) => ({
        session: sessionId === session.id ? session : staleFirstSession,
        quotes: [],
        reactions: [],
        bookmarks: []
      }),
      listAnnotations: async () => ({ annotations: [annotation] }),
      listCompanionComments: async () => ({ comments: [] })
    };
    const cloudSource = {
      restoreNovelSource: async (sessionId: string) => ({
        sourceText: sessionId === session.id
          ? "第一段不能预装。\n\n第二段和评论必须直接进入打开工具的结果。\n\n第三段不能预装。"
          : "错误书目的正文不能预装。",
        sourceManifest: { segmentationVersion: 1 }
      })
    };

    registerReadingTools(server as never, service as never, cloudSource as never);
    const result = await handlers.get("open_reading_nest")?.();

    expect(result.structuredContent).toMatchObject({
      sharedPage: {
        sessionId: session.id,
        position: session.userCurrentPosition,
        currentText: "第二段和评论必须直接进入打开工具的结果。"
      },
      annotations: [annotation],
      followupRecovery: {
        tool: "list_companion_comments",
        arguments: {
          sessionId: session.id,
          scope: "history",
          positionIndex: 2,
          limit: 20
        }
      },
      requiredParagraphWriteback: {
        publishTool: "publish_companion_comment",
        publishArguments: {
          sessionId: session.id,
          position: { kind: "paragraph", index: 2, label: "第 2 段" },
          mode: "reaction_only",
          length: "short",
          source: "live_reading",
          operationId: `live-recovery-v43:${session.id}:paragraph:2`
        }
      }
    });
    expect(result.content[0].text).toContain("第二段和评论必须直接进入打开工具的结果。");
    expect(result.content[0].text).toContain("Daddy收到这条了吗");
    expect(JSON.stringify(result)).not.toContain("第一段不能预装。");
    expect(JSON.stringify(result)).not.toContain("第三段不能预装。");
    expect(result.structuredContent.sharedPage.title).not.toBe("书架排第一但不是刚读的书");
  });

  it("declares the current page as an Apps SDK file param", () => {
    expect(TOOL_CONFIGS.send_current_context._meta?.["openai/fileParams"]).toEqual([
      "currentPageImage"
    ]);
  });

  it("does not expose a model API or ambiguous end session tool", () => {
    expect(Object.keys(TOOL_CONFIGS)).not.toContain("end_reading_session");
    expect(JSON.stringify(TOOL_CONFIGS)).not.toMatch(/OPENAI_API_KEY|responses|chat completions/i);
  });

  it("returns actively shared text in model-readable tool content", () => {
    const session = {
      id: "session-model-readable",
      title: "正文测试",
      type: "novel" as const,
      userCurrentPosition: { kind: "paragraph" as const, index: 7, label: "第 7 段" }
    } as never;
    const text = buildModelReadableCurrentContext(session, {
      sessionId: "session-model-readable",
      currentPosition: { kind: "paragraph", index: 7, label: "第 7 段" },
      currentText: "这是必须交给模型的正文。",
      selectedText: "这一句也必须看见。",
      mode: "live_reading"
    });

    expect(text).toContain("《正文测试》第 7 段");
    expect(text).toContain("这是必须交给模型的正文。");
    expect(text).toContain("这一句也必须看见。");
    expect(text).toContain("不要声称没有收到正文");
  });

  it("keeps send_current_context body visible to the model as text content", async () => {
    const handlers = new Map<string, (args: any) => Promise<any>>();
    const server = {
      registerTool: (name: string, _config: unknown, handler: (args: any) => Promise<any>) => {
        handlers.set(name, handler);
      }
    };
    const session = {
      id: "session-current-content",
      title: "正文交付测试",
      type: "novel",
      status: "active",
      userCurrentPosition: { kind: "paragraph", index: 9, label: "第 9 段" },
      assistantSyncedPosition: null,
      liveReadingEnabled: true,
      sessionPreferences: {
        readingCommentMode: "reaction_only",
        commentLength: "short"
      },
      sourceManifest: null,
      createdAt: "2026-08-29T00:00:00.000Z",
      updatedAt: "2026-08-29T00:00:00.000Z",
      lastReadAt: "2026-08-29T00:00:00.000Z"
    };
    const service = {
      getSessionBundle: async () => ({ session, quotes: [], reactions: [], bookmarks: [] }),
      getLayeredReadingContext: async () => ({ memories: [], facts: [] })
    };

    registerReadingTools(server as never, service as never);
    const result = await handlers.get("send_current_context")?.({
      sessionId: session.id,
      currentPosition: session.userCurrentPosition,
      currentText: "这段正文不能只留在 structuredContent。",
      mode: "live_reading",
      readingCommentMode: "reaction_only",
      commentLength: "short"
    });

    expect(result.structuredContent.context.currentText).toBe(
      "这段正文不能只留在 structuredContent。"
    );
    expect(result.content[0].text).toContain(
      "这段正文不能只留在 structuredContent。"
    );
  });

  it("exposes explicit assistant confirmation and live-reading tools", () => {
    expect(Object.keys(TOOL_CONFIGS)).toContain("confirm_assistant_synced_position");
    expect(Object.keys(TOOL_CONFIGS)).toContain("set_live_reading_mode");
    expect(
      TOOL_CONFIGS.confirm_assistant_synced_position.annotations.idempotentHint
    ).toBe(true);
  });

  it("exposes a metadata-only source manifest mutation tool", () => {
    expect(Object.keys(TOOL_CONFIGS)).toContain("set_source_manifest");
    expect(TOOL_CONFIGS.set_source_manifest.annotations.idempotentHint).toBe(true);
    expect(JSON.stringify(TOOL_CONFIGS.set_source_manifest)).not.toMatch(
      /currentText|selectedText|includedText|imageData|download_url/
    );
  });

  it("exposes an idempotent structured preference update tool", () => {
    expect(Object.keys(TOOL_CONFIGS)).toContain("update_session_preferences");
    expect(TOOL_CONFIGS.update_session_preferences.annotations).toMatchObject({
      readOnlyHint: false,
      idempotentHint: true
    });
    expect(JSON.stringify(TOOL_CONFIGS.update_session_preferences)).not.toMatch(
      /currentText|selectedText|includedText|currentPageImage/
    );
  });

  it("fills omitted comment preferences and preserves explicit values and source context", () => {
    const session = {
      id: "session-1",
      title: "偏好书",
      type: "novel" as const,
      status: "active" as const,
      userCurrentPosition: { kind: "paragraph" as const, index: 8, label: "第 8 段" },
      assistantSyncedPosition: null,
      liveReadingEnabled: false,
      sessionPreferences: {
        readingCommentMode: "cp_talk" as const,
        commentLength: "normal" as const,
        allowDeepAnalysisByDefault: false as const,
        liveReadingStyle: "danmaku" as const,
        autoSaveCompanionComments: true
      },
      sourceManifest: null,
      createdAt: "2026-06-22T00:00:00.000Z",
      updatedAt: "2026-06-22T00:00:00.000Z",
      lastReadAt: "2026-06-22T00:00:00.000Z"
    };
    const sourceContext = {
      contentHash: "a".repeat(64),
      segmentationVersion: 1,
      paragraphCount: 12
    };

    const fallback = buildCurrentReadingContext(session, {
      sessionId: session.id,
      currentPosition: session.userCurrentPosition,
      currentText: "当前段落",
      sourceContext,
      mode: "current_only"
    });
    const explicit = buildCurrentReadingContext(session, {
      sessionId: session.id,
      currentPosition: session.userCurrentPosition,
      currentText: "当前段落",
      mode: "current_only",
      readingCommentMode: "plot_guess",
      commentLength: "short"
    });
    const live = buildCurrentReadingContext(session, {
      sessionId: session.id,
      currentPosition: session.userCurrentPosition,
      includedText: "当前段和前一段",
      mode: "live_reading"
    });

    expect(fallback).toMatchObject({
      readingCommentMode: "cp_talk",
      commentLength: "normal",
      sourceContext
    });
    expect(explicit).toMatchObject({
      readingCommentMode: "plot_guess",
      commentLength: "short"
    });
    expect(live).toMatchObject({
      readingCommentMode: "reaction_only",
      commentLength: "short"
    });
  });

  it("exposes data-only companion comment tools with correct annotations", () => {
    expect(Object.keys(TOOL_CONFIGS)).toEqual(
      expect.arrayContaining([
        "publish_companion_comment",
        "list_companion_comments",
        "clear_companion_comments"
      ])
    );
    expect(TOOL_CONFIGS.publish_companion_comment.annotations.idempotentHint).toBe(true);
    expect(TOOL_CONFIGS.list_companion_comments.annotations.readOnlyHint).toBe(true);
    expect(TOOL_CONFIGS.clear_companion_comments.annotations.readOnlyHint).toBe(false);
    for (const name of [
      "publish_companion_comment",
      "list_companion_comments",
      "clear_companion_comments"
    ] as const) {
      expect("_meta" in TOOL_CONFIGS[name] ? TOOL_CONFIGS[name]._meta : undefined).toBeUndefined();
    }
  });

  it("exposes book management and threaded annotation tools", () => {
    expect(Object.keys(TOOL_CONFIGS)).toHaveLength(61);
    expect(TOOL_CONFIGS.create_annotation.annotations).toMatchObject({
      readOnlyHint: false,
      idempotentHint: true
    });
    expect(TOOL_CONFIGS.reply_to_annotation.annotations).toMatchObject({
      readOnlyHint: false,
      idempotentHint: true
    });
    expect(TOOL_CONFIGS.list_annotations.annotations).toMatchObject({
      readOnlyHint: true
    });
    expect(TOOL_CONFIGS.rename_reading_session.annotations).toMatchObject({
      readOnlyHint: false,
      idempotentHint: true
    });
    expect(TOOL_CONFIGS.set_reading_session_status.annotations).toMatchObject({
      readOnlyHint: false,
      idempotentHint: true
    });
    expect(TOOL_CONFIGS.delete_reading_session.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true
    });
    expect(
      TOOL_CONFIGS.delete_reading_session.inputSchema.parse({
        sessionId: "session-1",
        operationId: "delete-op-1",
        deleteCloudSource: true
      })
    ).toMatchObject({ deleteCloudSource: true });
    expect(() =>
      TOOL_CONFIGS.delete_reading_session.inputSchema.parse({
        sessionId: "session-1",
        operationId: "delete-op-1",
        deleteLocalCache: true
      })
    ).toThrow();
    expect(JSON.stringify(TOOL_CONFIGS.delete_reading_session)).not.toMatch(
      /sourceText|imageData|data:image|publicUrl|signedUrl/
    );
  });

  it("exposes metadata-only cloud source tools without full-text restore", () => {
    expect(Object.keys(TOOL_CONFIGS)).toEqual(
      expect.arrayContaining(["get_cloud_source_status", "delete_cloud_source"])
    );
    expect(Object.keys(TOOL_CONFIGS)).not.toContain("restore_cloud_source");
    expect(JSON.stringify(TOOL_CONFIGS.get_cloud_source_status)).not.toMatch(
      /sourceText|publicUrl|signedUrl|currentText|includedText/
    );
    expect(JSON.stringify(TOOL_CONFIGS.delete_cloud_source)).not.toMatch(
      /sourceText|publicUrl|signedUrl|currentText|includedText/
    );
  });

  it("reads exactly one live-reading paragraph from the server-side source", async () => {
    const handlers = new Map<string, (args: any) => Promise<any>>();
    const server = {
      registerTool: (name: string, _config: unknown, handler: (args: any) => Promise<any>) => {
        handlers.set(name, handler);
      }
    };
    const session = {
      id: "session-d1",
      title: "D1 里的书",
      type: "novel",
      status: "active",
      userCurrentPosition: { kind: "paragraph", index: 2, label: "第 2 段" },
      assistantSyncedPosition: null,
      liveReadingEnabled: true,
      sessionPreferences: {},
      sourceManifest: null,
      createdAt: "2026-08-27T00:00:00.000Z",
      updatedAt: "2026-08-27T00:00:00.000Z",
      lastReadAt: "2026-08-27T00:00:00.000Z"
    };
    const service = {
      listAllSessions: async () => [session],
      getSessionBundle: async () => ({ session, quotes: [], reactions: [], bookmarks: [] })
    };
    const cloudSource = {
      restoreNovelSource: async () => ({
        sourceText: "第一段只留在 D1。\n\n第二段会交给 Daddy。\n\n第三段不能泄露。",
        sourceManifest: {
          segmentationVersion: 1
        }
      })
    };

    registerReadingTools(server as never, service as never, cloudSource as never);
    const result = await handlers.get("read_live_reading_context")?.({
      sessionId: "session-d1",
      positionIndex: 2
    });

    expect(result.structuredContent).toMatchObject({
      available: true,
      sharedPage: {
        sessionId: "session-d1",
        title: "D1 里的书",
        position: { kind: "paragraph", index: 2, label: "第 2 段" },
        currentText: "第二段会交给 Daddy。"
      }
    });
    expect(result.content[0].text).toContain("第二段会交给 Daddy。");
    expect(JSON.stringify(result)).not.toContain("第一段只留在 D1。");
    expect(JSON.stringify(result)).not.toContain("第三段不能泄露。");
  });

  it("recovers one exact paragraph and its saved user annotation through the stable catalog", async () => {
    const handlers = new Map<string, (args: any) => Promise<any>>();
    const server = {
      registerTool: (name: string, _config: unknown, handler: (args: any) => Promise<any>) => {
        handlers.set(name, handler);
      }
    };
    const session = {
      id: "session-recovery",
      title: "旧入口里的书",
      type: "novel",
      userCurrentPosition: { kind: "paragraph", index: 67, label: "第 67 段" }
    };
    const annotation = {
      id: "annotation-67",
      sessionId: session.id,
      position: session.userCurrentPosition,
      anchor: { selectedText: "有" },
      messages: [{ id: "message-67", author: "user", text: "测试" }],
      updatedAt: "2026-08-29T12:18:09.983Z"
    };
    const service = {
      listAllSessions: async () => [session],
      getSessionBundle: async () => ({ session, quotes: [], reactions: [], bookmarks: [] }),
      listCompanionComments: async () => ({ comments: [] }),
      listAnnotations: async () => ({ annotations: [annotation] }),
      listAnnotationFavorites: async () => ({ favorites: [] }),
      listReadingMemories: async () => ({ memories: [] }),
      listReadingFacts: async () => ({ facts: [] }),
      listSkillCandidates: async () => ({ skillCandidates: [] }),
      getLayeredReadingContext: async () => ({ daily: true })
    };
    const cloudSource = {
      restoreNovelSource: async () => ({
        sourceText: Array.from({ length: 68 }, (_, index) =>
          index === 66 ? "第六十七段正文会和评论一起恢复。" : `私密段落 ${index + 1}`
        ).join("\n\n"),
        sourceManifest: { segmentationVersion: 1 }
      })
    };

    registerReadingTools(server as never, service as never, cloudSource as never);
    const result = await handlers.get("list_companion_comments")?.({
      sessionId: session.id,
      scope: "history",
      positionIndex: 67,
      limit: 10
    });

    expect(result.structuredContent).toMatchObject({
      sharedPage: {
        sessionId: session.id,
        position: session.userCurrentPosition,
        currentText: "第六十七段正文会和评论一起恢复。"
      },
      annotations: [annotation]
    });
    expect(result.content[0].text).toContain("第六十七段正文会和评论一起恢复。");
    expect(result.structuredContent.requiredWritebacks).toEqual([
      expect.objectContaining({
        annotationId: annotation.id,
        publishTool: "publish_companion_comment",
        publishArguments: expect.objectContaining({
          sessionId: session.id,
          position: session.userCurrentPosition,
          source: "current_context",
          operationId: "annotation-daddy-v25:annotation-67:message-67"
        })
      })
    ]);
    expect(result.content[0].text).toContain("必须先按 structuredContent.requiredWritebacks");
    expect(JSON.stringify(result)).not.toContain("私密段落 66");
    expect(JSON.stringify(result)).not.toContain("私密段落 68");
  });

  it("saves and reloads annotations through stable legacy-catalog tools", async () => {
    const handlers = new Map<string, (args: any) => Promise<any>>();
    const server = {
      registerTool: (name: string, _config: unknown, handler: (args: any) => Promise<any>) => {
        handlers.set(name, handler);
      }
    };
    const createAnnotation = async (input: any) => ({
      id: "annotation-1",
      sessionId: input.sessionId,
      position: input.position,
      anchor: input.anchor,
      createdBy: "user",
      messages: input.comment ? [{ id: "message-1", author: "user", text: input.comment }] : [],
      operationId: input.operationId,
      createdAt: "2026-08-11T00:00:00.000Z",
      updatedAt: "2026-08-11T00:00:00.000Z"
    });
    const replyToAnnotation = async (input: any) => ({
      id: input.annotationId,
      sessionId: input.sessionId,
      position: { kind: "paragraph", index: 12, label: "第 12 段" },
      anchor: { selectedText: "她把信折好" },
      createdBy: "user",
      messages: [{ id: "message-2", author: input.author, text: input.text }],
      createdAt: "2026-08-11T00:00:00.000Z",
      updatedAt: "2026-08-11T00:01:00.000Z"
    });
    const service = {
      listAllSessions: async () => [],
      getSessionBundle: async () => ({ session: {}, quotes: [], reactions: [], bookmarks: [] }),
      listCompanionComments: async () => ({ comments: [] }),
      listAnnotations: async () => ({ annotations: [{ id: "annotation-1" }] }),
      listAnnotationFavorites: async () => ({ favorites: [{ id: "favorite-1" }] }),
      listReadingMemories: async () => ({ memories: [{ id: "memory-1", updatedAt: "2026-08-11T00:00:00.000Z", revision: 1 }] }),
      listReadingFacts: async () => ({ facts: [{ id: "fact-1", updatedAt: "2026-08-11T00:00:00.000Z", revision: 1 }] }),
      listSkillCandidates: async () => ({ skillCandidates: [] }),
      getLayeredReadingContext: async () => ({ daily: true }),
      createAnnotation,
      replyToAnnotation,
      setAnnotationFavorite: async (input: any) => ({
        favorite: input.favorite,
        ...(input.favorite
          ? { item: { id: "favorite-compat", annotationId: input.annotationId } }
          : {})
      }),
      upsertReadingMemory: async (input: any) => ({ id: "memory-compat", ...input }),
      upsertReadingFact: async (input: any) => ({ id: "fact-compat", ...input }),
      upsertSkillCandidate: async (input: any) => ({ id: "skill-compat", ...input }),
      publishCompanionComment: async () => { throw new Error("annotation reply must not enter the Dock"); },
      saveQuote: async () => { throw new Error("must not save a quote"); },
      saveReaction: async () => { throw new Error("must not save a reaction"); }
    };

    registerReadingTools(server as never, service as never);
    const created = await handlers.get("save_quote")?.({
      sessionId: "session-1",
      content: "她把信折好",
      position: { kind: "paragraph", index: 12, label: "第 12 段" },
      note: `__ss_annotation_v24__:${JSON.stringify({
        startOffset: 3,
        endOffset: 9,
        prefix: "雨停后，",
        suffix: "放回抽屉。",
        comment: "这里像是在告别。"
      })}`,
      operationId: "annotation-v24:op-1"
    });
    const replied = await handlers.get("save_reaction")?.({
      sessionId: "session-1",
      content: `__ss_annotation_reply_v24__:${JSON.stringify({
        annotationId: "annotation-1",
        text: "嗯，我也是。"
      })}`,
      position: { kind: "paragraph", index: 12, label: "第 12 段" },
      speaker: "user",
      operationId: "annotation-reply-v24:op-2"
    });
    const listed = await handlers.get("list_companion_comments")?.({
      sessionId: "session-1",
      scope: "recent",
      positionIndex: 12,
      limit: 1
    });
    const unchanged = await handlers.get("list_companion_comments")?.({
      sessionId: "session-1",
      scope: "recent",
      positionIndex: 12,
      limit: 1,
      knownVersion: listed.structuredContent.version
    });
    const daddyReply = await handlers.get("publish_companion_comment")?.({
      sessionId: "session-1",
      position: { kind: "paragraph", index: 12, label: "第 12 段" },
      mode: "reaction_only",
      length: "short",
      text: "我也觉得，他是在给自己留最后一点体面。",
      source: "quick_action",
      operationId: "annotation-daddy-v25:annotation-1:reply-op-3"
    });
    const favoriteCompat = await handlers.get("save_quote")?.({
      sessionId: "session-1",
      content: `__ss_annotation_favorite_v32__:${JSON.stringify({
        annotationId: "annotation-1",
        favorite: true
      })}`,
      position: { kind: "paragraph", index: 12, label: "第 12 段" },
      operationId: "annotation-favorite-v32:favorite-op-1"
    });
    const memoryCompat = await handlers.get("save_quote")?.({
      sessionId: "session-1",
      content: `__ss_reading_memory_v32__:${JSON.stringify({
        kind: "chapter_summary",
        scope: "chapter",
        chapterLabel: "第 1–12 段",
        rangeStart: 1,
        rangeEnd: 12,
        content: "这一章发生了重要转折。",
        source: "daddy_read"
      })}`,
      position: { kind: "paragraph", index: 12, label: "第 12 段" },
      operationId: "reading-memory-v32:memory-op-1"
    });
    const factCompat = await handlers.get("save_quote")?.({
      sessionId: "session-1",
      content: `__ss_reading_fact_v32__:${JSON.stringify({
        subject: "来信",
        fact: "信被收回了抽屉。",
        source: "daddy_read"
      })}`,
      position: { kind: "paragraph", index: 12, label: "第 12 段" },
      operationId: "reading-fact-v32:fact-op-1"
    });
    const skillCompat = await handlers.get("save_quote")?.({
      sessionId: "session-1",
      content: `__ss_skill_candidate_v33__:${JSON.stringify({
        scope: "chapter",
        chapterLabel: "第 1–12 段",
        rangeStart: 1,
        rangeEnd: 12,
        totalUnits: 80,
        verdict: "knowledge_only",
        title: "只留知识卡",
        rationale: "还没有稳定工作流。",
        triggerExamples: [],
        workflow: [],
        boundaries: ["不可冒充全书结论"],
        sourceNotes: ["覆盖第 1–12 段"],
        analysisFingerprint: "snapshot-v1-deadbeef",
        status: "draft"
      })}`,
      position: { kind: "paragraph", index: 12, label: "第 12 段" },
      operationId: "skill-candidate-v33:snapshot-v1-deadbeef"
    });

    expect(created.structuredContent.annotation.anchor).toMatchObject({
      selectedText: "她把信折好",
      startOffset: 3,
      endOffset: 9
    });
    expect(created.structuredContent.annotation.messages[0].text).toBe("这里像是在告别。");
    expect(replied.structuredContent.annotation.messages[0].text).toBe("嗯，我也是。");
    expect(daddyReply.structuredContent.annotation.messages[0]).toMatchObject({
      author: "assistant",
      text: "我也觉得，他是在给自己留最后一点体面。"
    });
    expect(favoriteCompat.structuredContent).toMatchObject({
      saved: true,
      favorite: true,
      item: { id: "favorite-compat", annotationId: "annotation-1" }
    });
    expect(memoryCompat.structuredContent.memory).toMatchObject({
      id: "memory-compat",
      kind: "chapter_summary",
      operationId: "reading-memory-v32:memory-op-1"
    });
    expect(factCompat.structuredContent.fact).toMatchObject({
      id: "fact-compat",
      subject: "来信",
      operationId: "reading-fact-v32:fact-op-1"
    });
    expect(skillCompat.structuredContent.skillCandidate).toMatchObject({
      id: "skill-compat",
      verdict: "knowledge_only",
      analysisFingerprint: "snapshot-v1-deadbeef"
    });
    expect(listed.structuredContent.annotations).toEqual([{ id: "annotation-1" }]);
    expect(listed.structuredContent.favorites).toEqual([{ id: "favorite-1" }]);
    expect(listed.structuredContent.memories).toEqual([
      { id: "memory-1", updatedAt: "2026-08-11T00:00:00.000Z", revision: 1 }
    ]);
    expect(listed.structuredContent.facts).toEqual([
      { id: "fact-1", updatedAt: "2026-08-11T00:00:00.000Z", revision: 1 }
    ]);
    expect(listed.structuredContent.layeredContext).toEqual({ daily: true });
    expect(unchanged.structuredContent).toMatchObject({
      version: listed.structuredContent.version,
      unchanged: true,
      comments: [],
      annotations: []
    });
  });

  it("uploads cloud source through an app-only tool with metadata-only structured content", async () => {
    const handlers = new Map<string, (args: any) => Promise<any>>();
    const server = {
      registerTool: (name: string, _config: unknown, handler: (args: any) => Promise<any>) => {
        handlers.set(name, handler);
      }
    };
    const service = {
      listAllSessions: async () => [],
      getSessionBundle: async () => ({
        session: {},
        quotes: [],
        reactions: [],
        bookmarks: []
      })
    };
    const sourceManifest = {
      sourceId: "source-1",
      sourceKind: "pasted_text",
      contentHash: "a".repeat(64),
      segmentationVersion: 1,
      paragraphCount: 1,
      cloudSync: {
        enabled: true,
        provider: "r2",
        objectKey: "private/sources/source-1/source.txt",
        manifestObjectKey: "private/sources/source-1/manifest.json",
        sizeBytes: 12,
        mimeType: "text/plain;charset=utf-8"
      }
    };
    const cloudSource = {
      uploadNovelSource: async () => ({ sourceManifest }),
      uploadMangaSource: async () => ({ sourceManifest }),
      getCloudSourceStatus: async () => ({ status: "available" }),
      deleteCloudSource: async () => ({ deleted: true, cloudSourceDeleted: true })
    };

    registerReadingTools(server as never, service as never, cloudSource as never);
    const result = await handlers.get("upload_cloud_source")?.({
      sessionId: "session-1",
      sourceKind: "pasted_text",
      sourceText: "private source text"
    });

    expect(result.structuredContent).toMatchObject({
      uploaded: true,
      sessionId: "session-1",
      sourceId: "source-1",
      contentHash: "a".repeat(64),
      paragraphCount: 1,
      cloudSync: {
        enabled: true,
        provider: "r2",
        sizeBytes: 12,
        mimeType: "text/plain;charset=utf-8"
      }
    });
    expect(JSON.stringify(result.structuredContent)).not.toMatch(/private source text|objectKey|private\/sources/);
    expect(result._meta.sourceManifest.cloudSync.objectKey).toBe("private/sources/source-1/source.txt");
  });
});
