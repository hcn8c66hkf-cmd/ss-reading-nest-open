import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import {
  completeReadingSessionInputSchema,
  createAnnotationInputSchema,
  clearCompanionCommentsInputSchema,
  confirmAssistantSyncedPositionInputSchema,
  finishTodayReadingInputSchema,
  generateDiaryContextInputSchema,
  getCloudSourceStatusInputSchema,
  openReadingNestInputSchema,
  listCompanionCommentsInputSchema,
  listAnnotationsInputSchema,
  setAnnotationFavoriteInputSchema,
  listAnnotationFavoritesInputSchema,
  upsertReadingMemoryInputSchema,
  listReadingMemoriesInputSchema,
  upsertReadingFactInputSchema,
  listReadingFactsInputSchema,
  upsertSkillCandidateInputSchema,
  listSkillCandidatesInputSchema,
  getLayeredReadingContextInputSchema,
  publishCompanionCommentInputSchema,
  renameReadingSessionInputSchema,
  replyToAnnotationInputSchema,
  saveBookmarkInputSchema,
  saveQuoteInputSchema,
  saveReactionInputSchema,
  sendCurrentContextInputSchema,
  setLiveReadingModeInputSchema,
  setReadingSessionStatusInputSchema,
  setSourceManifestInputSchema,
  startReadingSessionInputSchema,
  textAnchorSchema,
  deleteReadingSessionInputSchema,
  deleteCloudSourceInputSchema,
  uploadCloudSourceInputSchema,
  updateSessionPreferencesInputSchema,
  updateReadingPositionInputSchema
} from "@ss/shared";
import type {
  ReadingSession,
  SendCurrentContextInput,
  SourceManifest,
  TextAnchor
} from "@ss/shared";
import { ReadingService } from "../services/reading-service.js";
import type { CloudSourceService } from "../services/cloud-source-service.js";
import { toolResult } from "./tool-result.js";

export const READING_NEST_URI = "ui://ss-reading-nest/app-v38.html";

const ANNOTATION_QUOTE_OPERATION_PREFIX = "annotation-v24:";
const ANNOTATION_QUOTE_NOTE_PREFIX = "__ss_annotation_v24__:";
const ANNOTATION_REPLY_OPERATION_PREFIX = "annotation-reply-v24:";
const ANNOTATION_REPLY_CONTENT_PREFIX = "__ss_annotation_reply_v24__:";
const DADDY_ANNOTATION_REPLY_OPERATION_PREFIX = "annotation-daddy-v25:";
const ANNOTATION_FAVORITE_COMPAT_OPERATION_PREFIX = "annotation-favorite-v32:";
const READING_MEMORY_COMPAT_OPERATION_PREFIX = "reading-memory-v32:";
const READING_FACT_COMPAT_OPERATION_PREFIX = "reading-fact-v32:";
const SKILL_CANDIDATE_COMPAT_OPERATION_PREFIX = "skill-candidate-v33:";
const ANNOTATION_FAVORITE_COMPAT_CONTENT_PREFIX = "__ss_annotation_favorite_v32__:";
const READING_MEMORY_COMPAT_CONTENT_PREFIX = "__ss_reading_memory_v32__:";
const READING_FACT_COMPAT_CONTENT_PREFIX = "__ss_reading_fact_v32__:";
const SKILL_CANDIDATE_COMPAT_CONTENT_PREFIX = "__ss_skill_candidate_v33__:";

const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false
};
const mutation = {
  readOnlyHint: false,
  destructiveHint: false,
  openWorldHint: false
};

export const TOOL_CONFIGS = {
  open_reading_nest_v38: {
    title: "打开 S×S 小窝共读",
    description:
      "Use this primary v38 tool when the user wants to open the reading nest or continue recent reading.",
    inputSchema: openReadingNestInputSchema,
    annotations: readOnly,
    _meta: {
      ui: { resourceUri: READING_NEST_URI },
      "ui/resourceUri": READING_NEST_URI,
      "openai/outputTemplate": READING_NEST_URI,
      "openai/toolInvocation/invoking": "正在点亮小窝…",
      "openai/toolInvocation/invoked": "小窝已经准备好"
    }
  },
  open_reading_nest_v37: {
    title: "打开 S×S 小窝共读（v37 兼容入口）",
    description:
      "Legacy compatibility entry. Prefer open_reading_nest_v38 whenever it is available.",
    inputSchema: openReadingNestInputSchema,
    annotations: readOnly,
    _meta: {
      ui: { resourceUri: READING_NEST_URI },
      "ui/resourceUri": READING_NEST_URI,
      "openai/outputTemplate": READING_NEST_URI,
      "openai/toolInvocation/invoking": "正在点亮小窝…",
      "openai/toolInvocation/invoked": "小窝已经准备好"
    }
  },
  open_reading_nest_v36: {
    title: "打开 S×S 小窝共读（v36 兼容入口）",
    description:
      "Legacy compatibility entry. Prefer open_reading_nest_v38 whenever it is available.",
    inputSchema: openReadingNestInputSchema,
    annotations: readOnly,
    _meta: {
      ui: { resourceUri: READING_NEST_URI },
      "ui/resourceUri": READING_NEST_URI,
      "openai/outputTemplate": READING_NEST_URI,
      "openai/toolInvocation/invoking": "正在点亮小窝…",
      "openai/toolInvocation/invoked": "小窝已经准备好"
    }
  },
  open_reading_nest_v35: {
    title: "打开 S×S 小窝共读（v35 兼容入口）",
    description:
      "Legacy compatibility entry. Prefer open_reading_nest_v36 whenever it is available.",
    inputSchema: openReadingNestInputSchema,
    annotations: readOnly,
    _meta: {
      ui: { resourceUri: READING_NEST_URI },
      "ui/resourceUri": READING_NEST_URI,
      "openai/outputTemplate": READING_NEST_URI,
      "openai/toolInvocation/invoking": "正在点亮小窝…",
      "openai/toolInvocation/invoked": "小窝已经准备好"
    }
  },
  open_reading_nest_v34: {
    title: "打开 S×S 小窝共读（v34 兼容入口）",
    description:
      "Legacy compatibility entry. Prefer open_reading_nest_v35 whenever it is available.",
    inputSchema: openReadingNestInputSchema,
    annotations: readOnly,
    _meta: {
      ui: { resourceUri: READING_NEST_URI },
      "ui/resourceUri": READING_NEST_URI,
      "openai/outputTemplate": READING_NEST_URI,
      "openai/toolInvocation/invoking": "正在点亮小窝…",
      "openai/toolInvocation/invoked": "小窝已经准备好"
    }
  },
  open_reading_nest_v33: {
    title: "打开 S×S 小窝共读（v33 兼容入口）",
    description:
      "Legacy compatibility entry. Prefer open_reading_nest_v34 whenever it is available.",
    inputSchema: openReadingNestInputSchema,
    annotations: readOnly,
    _meta: {
      ui: { resourceUri: READING_NEST_URI },
      "openai/outputTemplate": READING_NEST_URI,
      "openai/toolInvocation/invoking": "正在点亮小窝…",
      "openai/toolInvocation/invoked": "小窝已经准备好"
    }
  },
  open_reading_nest_v32: {
    title: "打开 S×S 小窝共读（v32 兼容入口）",
    description:
      "Legacy compatibility entry. Prefer open_reading_nest_v33 whenever it is available.",
    inputSchema: openReadingNestInputSchema,
    annotations: readOnly,
    _meta: {
      ui: { resourceUri: READING_NEST_URI },
      "openai/outputTemplate": READING_NEST_URI,
      "openai/toolInvocation/invoking": "正在点亮小窝…",
      "openai/toolInvocation/invoked": "小窝已经准备好"
    }
  },
  open_reading_nest_v31: {
    title: "打开 S×S 小窝共读（v31 兼容入口）",
    description:
      "Legacy compatibility entry. Prefer open_reading_nest_v32 whenever it is available.",
    inputSchema: openReadingNestInputSchema,
    annotations: readOnly,
    _meta: {
      ui: { resourceUri: READING_NEST_URI },
      "openai/outputTemplate": READING_NEST_URI,
      "openai/toolInvocation/invoking": "正在点亮小窝…",
      "openai/toolInvocation/invoked": "小窝已经准备好"
    }
  },
  open_reading_nest_v30: {
    title: "打开 S×S 小窝共读（v30 兼容入口）",
    description:
      "Legacy compatibility entry. Prefer open_reading_nest_v32 whenever it is available.",
    inputSchema: openReadingNestInputSchema,
    annotations: readOnly,
    _meta: {
      ui: { resourceUri: READING_NEST_URI },
      "openai/outputTemplate": READING_NEST_URI,
      "openai/toolInvocation/invoking": "正在点亮小窝…",
      "openai/toolInvocation/invoked": "小窝已经准备好"
    }
  },
  open_reading_nest_v29: {
    title: "打开 S×S 小窝共读（v29 兼容入口）",
    description:
      "Legacy compatibility entry. Prefer open_reading_nest_v32 whenever it is available.",
    inputSchema: openReadingNestInputSchema,
    annotations: readOnly,
    _meta: {
      ui: { resourceUri: READING_NEST_URI },
      "openai/outputTemplate": READING_NEST_URI,
      "openai/toolInvocation/invoking": "正在点亮小窝…",
      "openai/toolInvocation/invoked": "小窝已经准备好"
    }
  },
  open_reading_nest_v28: {
    title: "打开 S×S 小窝共读（v28 兼容入口）",
    description:
      "Legacy compatibility entry. Prefer open_reading_nest_v32 whenever it is available.",
    inputSchema: openReadingNestInputSchema,
    annotations: readOnly,
    _meta: {
      ui: { resourceUri: READING_NEST_URI },
      "openai/outputTemplate": READING_NEST_URI,
      "openai/toolInvocation/invoking": "正在点亮小窝…",
      "openai/toolInvocation/invoked": "小窝已经准备好"
    }
  },
  open_reading_nest_v27: {
    title: "打开 S×S 小窝共读（v27 兼容入口）",
    description:
      "Legacy compatibility entry. Prefer open_reading_nest_v32 whenever it is available.",
    inputSchema: openReadingNestInputSchema,
    annotations: readOnly,
    _meta: {
      ui: { resourceUri: READING_NEST_URI },
      "openai/outputTemplate": READING_NEST_URI,
      "openai/toolInvocation/invoking": "正在点亮小窝…",
      "openai/toolInvocation/invoked": "小窝已经准备好"
    }
  },
  open_reading_nest_v26: {
    title: "打开 S×S 小窝共读（v26 兼容入口）",
    description:
      "Legacy compatibility entry. Prefer open_reading_nest_v32 whenever it is available.",
    inputSchema: openReadingNestInputSchema,
    annotations: readOnly,
    _meta: {
      ui: { resourceUri: READING_NEST_URI },
      "openai/outputTemplate": READING_NEST_URI,
      "openai/toolInvocation/invoking": "正在点亮小窝…",
      "openai/toolInvocation/invoked": "小窝已经准备好"
    }
  },
  open_reading_nest_v25: {
    title: "打开 S×S 小窝共读（v25 兼容入口）",
    description:
      "Legacy compatibility entry. Prefer open_reading_nest_v32 whenever it is available.",
    inputSchema: openReadingNestInputSchema,
    annotations: readOnly,
    _meta: {
      ui: { resourceUri: READING_NEST_URI },
      "openai/outputTemplate": READING_NEST_URI,
      "openai/toolInvocation/invoking": "正在点亮小窝…",
      "openai/toolInvocation/invoked": "小窝已经准备好"
    }
  },
  open_reading_nest_v24: {
    title: "打开 S×S 小窝共读（v24 兼容入口）",
    description:
      "Legacy compatibility entry. Prefer open_reading_nest_v32 whenever it is available.",
    inputSchema: openReadingNestInputSchema,
    annotations: readOnly,
    _meta: {
      ui: { resourceUri: READING_NEST_URI },
      "openai/outputTemplate": READING_NEST_URI,
      "openai/toolInvocation/invoking": "正在点亮小窝…",
      "openai/toolInvocation/invoked": "小窝已经准备好"
    }
  },
  open_reading_nest_v23: {
    title: "打开 S×S 小窝共读（v23 兼容入口）",
    description:
      "Legacy compatibility entry. Prefer open_reading_nest_v32 whenever it is available.",
    inputSchema: openReadingNestInputSchema,
    annotations: readOnly,
    _meta: {
      ui: { resourceUri: READING_NEST_URI },
      "openai/outputTemplate": READING_NEST_URI,
      "openai/toolInvocation/invoking": "正在点亮小窝…",
      "openai/toolInvocation/invoked": "小窝已经准备好"
    }
  },
  open_reading_nest_v22: {
    title: "打开 S×S 小窝共读（v22 兼容入口）",
    description:
      "Legacy compatibility entry. Prefer open_reading_nest_v32 whenever it is available.",
    inputSchema: openReadingNestInputSchema,
    annotations: readOnly,
    _meta: {
      ui: { resourceUri: READING_NEST_URI },
      "openai/outputTemplate": READING_NEST_URI,
      "openai/toolInvocation/invoking": "正在点亮小窝…",
      "openai/toolInvocation/invoked": "小窝已经准备好"
    }
  },
  open_reading_nest: {
    title: "打开 S×S 小窝共读（旧入口）",
    description:
      "Legacy compatibility entry. Prefer open_reading_nest_v32 whenever it is available.",
    inputSchema: openReadingNestInputSchema,
    annotations: readOnly,
    _meta: {
      ui: { resourceUri: READING_NEST_URI },
      "openai/outputTemplate": READING_NEST_URI,
      "openai/toolInvocation/invoking": "正在点亮小窝…",
      "openai/toolInvocation/invoked": "小窝已经准备好"
    }
  },
  start_reading_session: {
    title: "开始共读",
    description: "Use this when the user starts reading a new novel or manga work.",
    inputSchema: startReadingSessionInputSchema,
    annotations: mutation
  },
  update_reading_position: {
    title: "更新阅读进度",
    description: "Use this when the current paragraph or manga page changes.",
    inputSchema: updateReadingPositionInputSchema,
    annotations: { ...mutation, idempotentHint: true }
  },
  confirm_assistant_synced_position: {
    title: "确认Daddy已读位置",
    description:
      "Use this only after the user explicitly confirms that ChatGPT replied it has read through a batch end.",
    inputSchema: confirmAssistantSyncedPositionInputSchema,
    annotations: { ...mutation, idempotentHint: true }
  },
  set_live_reading_mode: {
    title: "设置实时陪读模式",
    description: "Use this when the user enables or disables lightweight live reading.",
    inputSchema: setLiveReadingModeInputSchema,
    annotations: { ...mutation, idempotentHint: true }
  },
  set_source_manifest: {
    title: "确认本设备阅读来源",
    description:
      "Use this when the app has computed source hash metadata for the current novel or manga. Never send source text or image bytes.",
    inputSchema: setSourceManifestInputSchema,
    annotations: { ...mutation, idempotentHint: true }
  },
  get_cloud_source_status: {
    title: "检查私人云端正文状态",
    description:
      "Use this to check whether a reading source exists in private cloud storage. Returns metadata only.",
    inputSchema: getCloudSourceStatusInputSchema,
    annotations: readOnly
  },
  upload_cloud_source: {
    title: "Upload private cloud source",
    description:
      "App-only bridge tool for uploading user-provided source bytes to private R2. Returns metadata only and never returns source text or image bytes.",
    inputSchema: uploadCloudSourceInputSchema,
    annotations: { ...mutation, idempotentHint: true },
    _meta: {
      ui: { visibility: ["app"] }
    }
  },
  delete_cloud_source: {
    title: "删除私人云端正文副本",
    description:
      "Use this only after the user confirms deleting the private cloud source copy. Returns metadata only.",
    inputSchema: deleteCloudSourceInputSchema,
    annotations: {
      ...mutation,
      destructiveHint: true,
      idempotentHint: true
    }
  },
  update_session_preferences: {
    title: "更新陪读偏好",
    description:
      "Use this when the user changes how ChatGPT should comment for this reading session.",
    inputSchema: updateSessionPreferencesInputSchema,
    annotations: { ...mutation, idempotentHint: true }
  },
  publish_companion_comment: {
    title: "发布Daddy陪读短评",
    description:
      "Use this before replying with a lightweight reading comment so the same short text appears in the reading Dock.",
    inputSchema: publishCompanionCommentInputSchema,
    annotations: { ...mutation, idempotentHint: true }
  },
  list_companion_comments: {
    title: "读取Daddy陪读短评",
    description:
      "Use this when the reading widget needs recent or paged historical companion comments for one session.",
    inputSchema: listCompanionCommentsInputSchema,
    annotations: readOnly
  },
  clear_companion_comments: {
    title: "清除Daddy陪读短评",
    description:
      "Use this when the user explicitly clears recent, historical, or all companion comments for one session.",
    inputSchema: clearCompanionCommentsInputSchema,
    annotations: { ...mutation, idempotentHint: true }
  },
  create_annotation: {
    title: "创建共读划线批注",
    description:
      "Use this when the user or assistant selects exact book text to underline, optionally with the first comment.",
    inputSchema: createAnnotationInputSchema,
    annotations: { ...mutation, idempotentHint: true }
  },
  create_annotation_v23: {
    title: "页面创建共读划线批注",
    description: "App-only v23 bridge for creating an anchored annotation from the reading page.",
    inputSchema: createAnnotationInputSchema,
    annotations: { ...mutation, idempotentHint: true },
    _meta: { ui: { visibility: ["app"] } }
  },
  reply_to_annotation: {
    title: "回复共读批注",
    description:
      "Use this when the user or assistant replies inside an existing anchored annotation thread.",
    inputSchema: replyToAnnotationInputSchema,
    annotations: { ...mutation, idempotentHint: true }
  },
  reply_to_annotation_v23: {
    title: "页面回复共读批注",
    description: "App-only v23 bridge for replying to an annotation from the reading page.",
    inputSchema: replyToAnnotationInputSchema,
    annotations: { ...mutation, idempotentHint: true },
    _meta: { ui: { visibility: ["app"] } }
  },
  list_annotations: {
    title: "读取共读划线批注",
    description:
      "Use this when the reading widget needs anchored highlights and their reply threads.",
    inputSchema: listAnnotationsInputSchema,
    annotations: readOnly
  },
  list_annotations_v23: {
    title: "页面读取共读划线批注",
    description: "App-only v23 bridge for loading annotations into the reading page.",
    inputSchema: listAnnotationsInputSchema,
    annotations: readOnly,
    _meta: { ui: { visibility: ["app"] } }
  },
  set_annotation_favorite: {
    title: "收藏或取消收藏共读批注",
    description: "Use this when the user favorites an annotation thread or one reply inside it.",
    inputSchema: setAnnotationFavoriteInputSchema,
    annotations: { ...mutation, idempotentHint: true },
    _meta: { ui: { visibility: ["app"] } }
  },
  list_annotation_favorites: {
    title: "读取收藏的共读批注",
    description: "Use this when the reading widget displays favorited annotation threads and replies.",
    inputSchema: listAnnotationFavoritesInputSchema,
    annotations: readOnly,
    _meta: { ui: { visibility: ["app"] } }
  },
  upsert_reading_memory: {
    title: "保存或修订长期阅读记忆",
    description:
      "Use this to persist a chapter summary, annotation summary, shared reading impression, or editable book/chapter context. Preserve the declared source and never label assistant_scan as Daddy-read memory.",
    inputSchema: upsertReadingMemoryInputSchema,
    annotations: { ...mutation, idempotentHint: true }
  },
  list_reading_memories: {
    title: "读取长期阅读记忆",
    description: "Use this to retrieve active or historical reading memories for one book.",
    inputSchema: listReadingMemoriesInputSchema,
    annotations: readOnly
  },
  upsert_reading_fact: {
    title: "保存或修订阅读事实卡",
    description:
      "Use this to add, revise, or invalidate a sourced fact card while preserving its revision chain.",
    inputSchema: upsertReadingFactInputSchema,
    annotations: { ...mutation, idempotentHint: true }
  },
  list_reading_facts: {
    title: "读取阅读事实卡",
    description: "Use this to retrieve active or historical fact cards for one book.",
    inputSchema: listReadingFactsInputSchema,
    annotations: readOnly
  },
  upsert_skill_candidate: {
    title: "保存读后 Skill 候选",
    description:
      "Use this to persist a reviewed P3 forge verdict and optional SKILL.md candidate. Never include full source text.",
    inputSchema: upsertSkillCandidateInputSchema,
    annotations: { ...mutation, idempotentHint: true }
  },
  list_skill_candidates: {
    title: "读取读后 Skill 候选",
    description:
      "Use this to retrieve P3 forge verdicts and reviewable Skill candidates for one reading session.",
    inputSchema: listSkillCandidatesInputSchema,
    annotations: readOnly
  },
  get_layered_reading_context: {
    title: "读取分层共读上下文",
    description:
      "Use daily depth for lightweight following and deep depth only for explicit close reading. Returns structured memories and facts, never full source text.",
    inputSchema: getLayeredReadingContextInputSchema,
    annotations: readOnly
  },
  rename_reading_session: {
    title: "重命名书籍",
    description: "Use this when the user explicitly changes one reading session title.",
    inputSchema: renameReadingSessionInputSchema,
    annotations: { ...mutation, idempotentHint: true }
  },
  set_reading_session_status: {
    title: "更新作品状态",
    description: "Use this when the user explicitly marks a work completed or active again.",
    inputSchema: setReadingSessionStatusInputSchema,
    annotations: { ...mutation, idempotentHint: true }
  },
  delete_reading_session: {
    title: "删除书籍阅读数据",
    description: "Use this only after the user confirms deleting one session's structured data.",
    inputSchema: deleteReadingSessionInputSchema,
    annotations: {
      ...mutation,
      destructiveHint: true,
      idempotentHint: true
    }
  },
  send_current_context: {
    title: "同步当前阅读内容",
    description:
      "Use this when the user explicitly asks ChatGPT to look at the current paragraph or current manga page.",
    inputSchema: sendCurrentContextInputSchema,
    annotations: readOnly,
    _meta: {
      "openai/fileParams": ["currentPageImage"]
    }
  },
  save_quote: {
    title: "保存摘录",
    description: "Use this when the user explicitly saves a selected sentence or manga page description.",
    inputSchema: saveQuoteInputSchema,
    annotations: { ...mutation, idempotentHint: true }
  },
  save_reaction: {
    title: "保存吐槽",
    description: "Use this when the user saves their reaction to the current reading position.",
    inputSchema: saveReactionInputSchema,
    annotations: { ...mutation, idempotentHint: true }
  },
  save_bookmark: {
    title: "保存书签",
    description: "Use this when the user wants to remember the current reading position.",
    inputSchema: saveBookmarkInputSchema,
    annotations: { ...mutation, idempotentHint: true }
  },
  finish_today_reading: {
    title: "今天看到这里",
    description: "Use this when the user stops for today but has not completed the whole work.",
    inputSchema: finishTodayReadingInputSchema,
    annotations: { ...mutation, idempotentHint: true }
  },
  complete_reading_session: {
    title: "完成这部作品",
    description: "Use this only when the user explicitly says they finished the whole work.",
    inputSchema: completeReadingSessionInputSchema,
    annotations: { ...mutation, idempotentHint: true }
  },
  generate_diary_context: {
    title: "生成小窝日记素材",
    description: "Use this when the user wants ChatGPT to write today's copyable reading diary.",
    inputSchema: generateDiaryContextInputSchema,
    annotations: readOnly
  }
} as const;

function decodeAnnotationQuote(input: {
  content: string;
  note?: string;
  operationId?: string;
}): { anchor: TextAnchor; comment?: string } | null {
  if (!input.operationId?.startsWith(ANNOTATION_QUOTE_OPERATION_PREFIX)) return null;
  if (!input.note?.startsWith(ANNOTATION_QUOTE_NOTE_PREFIX)) {
    throw new Error("Invalid annotation compatibility payload");
  }
  const payload = JSON.parse(input.note.slice(ANNOTATION_QUOTE_NOTE_PREFIX.length)) as {
    startOffset?: unknown;
    endOffset?: unknown;
    prefix?: unknown;
    suffix?: unknown;
    comment?: unknown;
  };
  const anchor = textAnchorSchema.parse({
    selectedText: input.content,
    ...(payload.startOffset !== undefined ? { startOffset: payload.startOffset } : {}),
    ...(payload.endOffset !== undefined ? { endOffset: payload.endOffset } : {}),
    ...(payload.prefix !== undefined ? { prefix: payload.prefix } : {}),
    ...(payload.suffix !== undefined ? { suffix: payload.suffix } : {})
  });
  const comment = typeof payload.comment === "string" ? payload.comment.trim() : undefined;
  if (comment && comment.length > 2_000) {
    throw new Error("Annotation comment is too long");
  }
  return { anchor, ...(comment ? { comment } : {}) };
}

function decodeAnnotationReply(input: {
  content: string;
  operationId?: string;
}): { annotationId: string; text: string } | null {
  if (!input.operationId?.startsWith(ANNOTATION_REPLY_OPERATION_PREFIX)) return null;
  if (!input.content.startsWith(ANNOTATION_REPLY_CONTENT_PREFIX)) {
    throw new Error("Invalid annotation reply compatibility payload");
  }
  const payload = JSON.parse(
    input.content.slice(ANNOTATION_REPLY_CONTENT_PREFIX.length)
  ) as { annotationId?: unknown; text?: unknown };
  const annotationId = typeof payload.annotationId === "string"
    ? payload.annotationId.trim()
    : "";
  const text = typeof payload.text === "string" ? payload.text.trim() : "";
  if (!annotationId || !text || text.length > 2_000) {
    throw new Error("Invalid annotation reply compatibility payload");
  }
  return { annotationId, text };
}

function decodeDaddyAnnotationReplyOperation(operationId: string): string | null {
  if (!operationId.startsWith(DADDY_ANNOTATION_REPLY_OPERATION_PREFIX)) return null;
  const encodedWithNonce = operationId.slice(DADDY_ANNOTATION_REPLY_OPERATION_PREFIX.length);
  const separator = encodedWithNonce.lastIndexOf(":");
  if (separator <= 0) throw new Error("Invalid Daddy annotation reply operation");
  const encodedAnnotationId = encodedWithNonce.slice(0, separator);
  const annotationId = decodeURIComponent(encodedAnnotationId).trim();
  if (!annotationId) throw new Error("Invalid Daddy annotation reply operation");
  return annotationId;
}

function decodeCompatJson(
  content: string,
  operationId: string | undefined,
  operationPrefix: string,
  contentPrefix: string
): Record<string, unknown> | null {
  if (!operationId?.startsWith(operationPrefix)) return null;
  if (!content.startsWith(contentPrefix)) {
    throw new Error("Invalid reading compatibility payload");
  }
  const parsed = JSON.parse(content.slice(contentPrefix.length)) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid reading compatibility payload");
  }
  return parsed as Record<string, unknown>;
}

function collectionVersion(items: unknown[]): string {
  const value = JSON.stringify(items);
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return `v1-${items.length}-${(hash >>> 0).toString(36)}`;
}

export function registerReadingTools(
  server: McpServer,
  service: ReadingService,
  cloudSourceService?: CloudSourceService,
  options: { sourceEndpointBase?: string } = {}
) {
  const openReadingNest = async () => {
    const sessions = await service.listAllSessions();
    const bookshelfSessions = await Promise.all(
      sessions.map(async (session) => ({
        ...(await service.getSessionBundle(session.id)),
        cacheState: "unknown" as const
      }))
    );
    return toolResult(
      {
        bookshelfSessions,
        recentSessions: bookshelfSessions.slice(0, 10),
        ...(options.sourceEndpointBase ? { sourceEndpointBase: options.sourceEndpointBase } : {})
      },
      "已打开 S×S 小窝共读。"
    );
  };

  registerAppTool(
    server,
    "open_reading_nest_v38",
    TOOL_CONFIGS.open_reading_nest_v38,
    openReadingNest
  );
  registerAppTool(
    server,
    "open_reading_nest_v37",
    TOOL_CONFIGS.open_reading_nest_v37,
    openReadingNest
  );
  registerAppTool(
    server,
    "open_reading_nest_v36",
    TOOL_CONFIGS.open_reading_nest_v36,
    openReadingNest
  );
  registerAppTool(
    server,
    "open_reading_nest_v35",
    TOOL_CONFIGS.open_reading_nest_v35,
    openReadingNest
  );
  registerAppTool(
    server,
    "open_reading_nest_v34",
    TOOL_CONFIGS.open_reading_nest_v34,
    openReadingNest
  );

  registerAppTool(
    server,
    "open_reading_nest_v33",
    TOOL_CONFIGS.open_reading_nest_v33,
    openReadingNest
  );

  registerAppTool(
    server,
    "open_reading_nest_v32",
    TOOL_CONFIGS.open_reading_nest_v32,
    openReadingNest
  );

  registerAppTool(
    server,
    "open_reading_nest_v31",
    TOOL_CONFIGS.open_reading_nest_v31,
    openReadingNest
  );
  registerAppTool(
    server,
    "open_reading_nest_v30",
    TOOL_CONFIGS.open_reading_nest_v30,
    openReadingNest
  );
  registerAppTool(
    server,
    "open_reading_nest_v29",
    TOOL_CONFIGS.open_reading_nest_v29,
    openReadingNest
  );
  registerAppTool(
    server,
    "open_reading_nest_v28",
    TOOL_CONFIGS.open_reading_nest_v28,
    openReadingNest
  );
  registerAppTool(
    server,
    "open_reading_nest_v27",
    TOOL_CONFIGS.open_reading_nest_v27,
    openReadingNest
  );
  registerAppTool(
    server,
    "open_reading_nest_v26",
    TOOL_CONFIGS.open_reading_nest_v26,
    openReadingNest
  );
  registerAppTool(
    server,
    "open_reading_nest_v25",
    TOOL_CONFIGS.open_reading_nest_v25,
    openReadingNest
  );
  registerAppTool(
    server,
    "open_reading_nest_v24",
    TOOL_CONFIGS.open_reading_nest_v24,
    openReadingNest
  );
  registerAppTool(
    server,
    "open_reading_nest_v23",
    TOOL_CONFIGS.open_reading_nest_v23,
    openReadingNest
  );
  registerAppTool(
    server,
    "open_reading_nest_v22",
    TOOL_CONFIGS.open_reading_nest_v22,
    openReadingNest
  );
  registerAppTool(server, "open_reading_nest", TOOL_CONFIGS.open_reading_nest, openReadingNest);

  server.registerTool(
    "start_reading_session",
    TOOL_CONFIGS.start_reading_session,
    async ({ title, type }) => {
      const session = await service.startSession(title, type);
      return toolResult({ session }, `已开始共读《${session.title}》。`);
    }
  );

  server.registerTool(
    "update_reading_position",
    TOOL_CONFIGS.update_reading_position,
    async ({ sessionId, userCurrentPosition }) => {
      const session = await service.updateUserPosition(sessionId, userCurrentPosition);
      return toolResult(
        {
          sessionId,
          userCurrentPosition: session.userCurrentPosition,
          assistantSyncedPosition: session.assistantSyncedPosition,
          updatedAt: session.updatedAt
        },
        `用户进度已更新到${userCurrentPosition.label}。`
      );
    }
  );

  server.registerTool(
    "confirm_assistant_synced_position",
    TOOL_CONFIGS.confirm_assistant_synced_position,
    async (input) => {
      const session = await service.confirmAssistantPosition(input);
      return toolResult(
        {
          sessionId: session.id,
          assistantSyncedPosition: session.assistantSyncedPosition,
          confirmedBatchId: input.batchId,
          updatedAt: session.updatedAt
        },
        `已由用户确认Daddy读到${input.confirmedPosition.label}。`
      );
    }
  );

  server.registerTool(
    "set_live_reading_mode",
    TOOL_CONFIGS.set_live_reading_mode,
    async ({ sessionId, enabled }) => {
      const session = await service.setLiveReadingMode(sessionId, enabled);
      return toolResult(
        {
          sessionId,
          liveReadingEnabled: session.liveReadingEnabled,
          updatedAt: session.updatedAt
        },
        enabled ? "实时陪读模式已开启。" : "实时陪读模式已关闭。"
      );
    }
  );

  server.registerTool(
    "set_source_manifest",
    TOOL_CONFIGS.set_source_manifest,
    async ({ sessionId, sourceManifest }) => {
      const session = await service.setSourceManifest(sessionId, sourceManifest);
      return toolResult(
        {
          sessionId,
          sourceManifest: session.sourceManifest,
          updatedAt: session.updatedAt
        },
        "本设备阅读来源已校验并保存。"
      );
    }
  );

  server.registerTool(
    "get_cloud_source_status",
    TOOL_CONFIGS.get_cloud_source_status,
    async ({ sessionId }) => {
      if (!cloudSourceService) {
        return toolResult({ status: "disabled" as const }, "私人云端正文服务尚未启用。");
      }
      const result = await cloudSourceService.getCloudSourceStatus(sessionId);
      return toolResult(result, "已检查这本书的私人云端正文状态。");
    }
  );

  registerAppTool(server, "upload_cloud_source", TOOL_CONFIGS.upload_cloud_source, async (input) => {
    if (!cloudSourceService) {
      return toolResult({ uploaded: false }, "私人云端正文服务尚未启用。");
    }
    const result =
      input.sourceKind === "manga_import"
        ? await cloudSourceService.uploadMangaSource({
            sessionId: input.sessionId,
            ...(input.title ? { title: input.title } : {}),
            pages: input.pages.map((page) => ({
              index: page.index,
              bytes: base64ToBytes(page.bytesBase64),
              mimeType: page.mimeType,
              ...(page.fileName ? { fileName: page.fileName } : {})
            }))
          })
        : await cloudSourceService.uploadNovelSource({
            sessionId: input.sessionId,
            sourceKind: input.sourceKind,
            ...(input.title ? { title: input.title } : {}),
            sourceText: input.sourceText
          });
    const response = toolResult(
      {
        uploaded: true,
        sessionId: input.sessionId,
        ...summarizeCloudSourceManifest(result.sourceManifest)
      },
      "私人云端正文已上传。"
    );
    return {
      ...response,
      _meta: { sourceManifest: result.sourceManifest }
    };
  });

  server.registerTool(
    "delete_cloud_source",
    TOOL_CONFIGS.delete_cloud_source,
    async ({ sessionId }) => {
      if (!cloudSourceService) {
        return toolResult({ deleted: false }, "私人云端正文服务尚未启用。");
      }
      const result = await cloudSourceService.deleteCloudSource(sessionId);
      return toolResult(result, result.deleted ? "私人云端正文副本已删除。" : "没有可删除的私人云端正文副本。");
    }
  );

  server.registerTool(
    "update_session_preferences",
    TOOL_CONFIGS.update_session_preferences,
    async ({ sessionId, preferences }) => {
      const session = await service.updateSessionPreferences(sessionId, preferences);
      return toolResult(
        {
          sessionId,
          sessionPreferences: session.sessionPreferences,
          updatedAt: session.updatedAt
        },
        "本书的陪读偏好已更新。"
      );
    }
  );

  server.registerTool(
    "publish_companion_comment",
    TOOL_CONFIGS.publish_companion_comment,
    async (input) => {
      const annotationId = decodeDaddyAnnotationReplyOperation(input.operationId);
      if (annotationId) {
        const annotation = await service.replyToAnnotation({
          sessionId: input.sessionId,
          annotationId,
          author: "assistant",
          text: input.text,
          operationId: input.operationId
        });
        return toolResult(
          { saved: true, annotation },
          "Daddy的回复已经接在这条批注下面。请在聊天区回复相同内容。"
        );
      }
      const comment = await service.publishCompanionComment(input);
      return toolResult(
        { saved: true, comment },
        "陪读短评已同步到这本书的小窝。请在聊天区回复相同短评。"
      );
    }
  );

  server.registerTool(
    "list_companion_comments",
    TOOL_CONFIGS.list_companion_comments,
    async ({ knownVersion, ...input }) => {
      const [
        result,
        annotationResult,
        favoriteResult,
        memoryResult,
        factResult,
        skillResult,
        layeredContext
      ] =
        await Promise.all([
          service.listCompanionComments(input),
          input.positionIndex
            ? service.listAnnotations({
                sessionId: input.sessionId,
                positionIndex: input.positionIndex
              })
            : undefined,
          service.listAnnotationFavorites(input.sessionId),
          service.listReadingMemories({
            sessionId: input.sessionId,
            includeSuperseded: false,
            limit: 50
          }),
          service.listReadingFacts({
            sessionId: input.sessionId,
            includeInactive: false,
            limit: 100
          }),
          service.listSkillCandidates({
            sessionId: input.sessionId,
            limit: 20
          }),
          input.positionIndex
            ? service.getLayeredReadingContext({
                sessionId: input.sessionId,
                depth: "daily",
                positionIndex: input.positionIndex
              })
            : undefined
        ]);
      const version = collectionVersion([
        ...result.comments.map((comment) => ({
          id: comment.id,
          updatedAt: comment.updatedAt ?? comment.createdAt,
          inRecent: comment.inRecent,
          inHistory: comment.inHistory
        })),
        ...(annotationResult?.annotations ?? []).map((annotation) => ({
          id: annotation.id,
          updatedAt: annotation.updatedAt,
          lastMessageId: annotation.messages?.at(-1)?.id ?? ""
        })),
        ...favoriteResult.favorites.map((item) => ({
          id: item.id,
          operationId: item.operationId
        })),
        ...memoryResult.memories.map((item) => ({
          id: item.id,
          updatedAt: item.updatedAt,
          revision: item.revision
        })),
        ...factResult.facts.map((item) => ({
          id: item.id,
          updatedAt: item.updatedAt,
          revision: item.revision
        })),
        ...skillResult.skillCandidates.map((item) => ({
          id: item.id,
          updatedAt: item.updatedAt,
          fingerprint: item.analysisFingerprint
        }))
      ]);
      const unchanged = knownVersion === version;
      return toolResult(
        {
          version,
          unchanged,
          ...(unchanged
            ? { comments: [], ...(annotationResult ? { annotations: [] } : {}) }
            : {
                ...result,
                ...(annotationResult ?? {}),
                ...favoriteResult,
                ...memoryResult,
                ...factResult,
                ...skillResult,
                ...(layeredContext ? { layeredContext } : {})
              })
        },
        unchanged ? "Daddy陪读短评没有更新。" : "已读取这本书的Daddy陪读短评。"
      );
    }
  );

  server.registerTool(
    "clear_companion_comments",
    TOOL_CONFIGS.clear_companion_comments,
    async ({ sessionId, scope }) => {
      const result = await service.clearCompanionComments(sessionId, scope);
      return toolResult(
        { sessionId, scope, ...result },
        "已按用户选择清除这本书的陪读短评。"
      );
    }
  );

  server.registerTool(
    "create_annotation",
    TOOL_CONFIGS.create_annotation,
    async (input) => {
      const annotation = await service.createAnnotation(input);
      return toolResult(
        { saved: true, annotation },
        input.author === "assistant"
          ? "Daddy的划线批注已写进这本书。"
          : "你的划线批注已写进这本书。"
      );
    }
  );

  registerAppTool(
    server,
    "create_annotation_v23",
    TOOL_CONFIGS.create_annotation_v23,
    async (input) => {
      const annotation = await service.createAnnotation(input);
      return toolResult({ saved: true, annotation }, "你的划线批注已写进这本书。");
    }
  );

  server.registerTool(
    "reply_to_annotation",
    TOOL_CONFIGS.reply_to_annotation,
    async (input) => {
      const annotation = await service.replyToAnnotation(input);
      return toolResult(
        { saved: true, annotation },
        input.author === "assistant" ? "Daddy已经回复这条批注。" : "你的回复已经保存。"
      );
    }
  );

  registerAppTool(
    server,
    "reply_to_annotation_v23",
    TOOL_CONFIGS.reply_to_annotation_v23,
    async (input) => {
      const annotation = await service.replyToAnnotation(input);
      return toolResult({ saved: true, annotation }, "你的回复已经保存。");
    }
  );

  server.registerTool(
    "list_annotations",
    TOOL_CONFIGS.list_annotations,
    async (input) => {
      const result = await service.listAnnotations(input);
      return toolResult(result, "已读取这本书的共读划线与评论线程。");
    }
  );

  registerAppTool(
    server,
    "list_annotations_v23",
    TOOL_CONFIGS.list_annotations_v23,
    async (input) => {
      const result = await service.listAnnotations(input);
      return toolResult(result, "已读取这本书的共读划线与评论线程。");
    }
  );

  registerAppTool(
    server,
    "set_annotation_favorite",
    TOOL_CONFIGS.set_annotation_favorite,
    async (input) => {
      const result = await service.setAnnotationFavorite(input);
      return toolResult(
        result,
        result.favorite ? "这条共读批注已经收藏。" : "这条共读批注已取消收藏。"
      );
    }
  );

  registerAppTool(
    server,
    "list_annotation_favorites",
    TOOL_CONFIGS.list_annotation_favorites,
    async ({ sessionId }) => {
      const result = await service.listAnnotationFavorites(sessionId);
      return toolResult(result, "已读取收藏的共读批注。" );
    }
  );

  server.registerTool(
    "upsert_reading_memory",
    TOOL_CONFIGS.upsert_reading_memory,
    async (input) => {
      const memory = await service.upsertReadingMemory(input);
      return toolResult({ saved: true, memory }, "长期阅读记忆已经保存。");
    }
  );

  server.registerTool(
    "list_reading_memories",
    TOOL_CONFIGS.list_reading_memories,
    async (input) => {
      const result = await service.listReadingMemories(input);
      return toolResult(result, "已读取这本书的长期阅读记忆。" );
    }
  );

  server.registerTool(
    "upsert_reading_fact",
    TOOL_CONFIGS.upsert_reading_fact,
    async (input) => {
      const fact = await service.upsertReadingFact(input);
      return toolResult({ saved: true, fact }, "阅读事实卡已经保存。");
    }
  );

  server.registerTool(
    "list_reading_facts",
    TOOL_CONFIGS.list_reading_facts,
    async (input) => {
      const result = await service.listReadingFacts(input);
      return toolResult(result, "已读取这本书的事实卡。" );
    }
  );

  server.registerTool(
    "upsert_skill_candidate",
    TOOL_CONFIGS.upsert_skill_candidate,
    async (input) => {
      const skillCandidate = await service.upsertSkillCandidate(input);
      return toolResult({ saved: true, skillCandidate }, "读后炼制候选已经保存。");
    }
  );

  server.registerTool(
    "list_skill_candidates",
    TOOL_CONFIGS.list_skill_candidates,
    async (input) => {
      const result = await service.listSkillCandidates(input);
      return toolResult(result, "已读取这本书的读后炼制候选。" );
    }
  );

  server.registerTool(
    "get_layered_reading_context",
    TOOL_CONFIGS.get_layered_reading_context,
    async (input) => {
      const context = await service.getLayeredReadingContext(input);
      return toolResult({ context }, "已按需要加载分层共读上下文。" );
    }
  );

  server.registerTool(
    "rename_reading_session",
    TOOL_CONFIGS.rename_reading_session,
    async ({ sessionId, title }) => {
      const session = await service.renameSession(sessionId, title);
      return toolResult({ session }, `已将作品重命名为《${session.title}》。`);
    }
  );

  server.registerTool(
    "set_reading_session_status",
    TOOL_CONFIGS.set_reading_session_status,
    async ({ sessionId, status }) => {
      const session = await service.setSessionStatus(sessionId, status);
      return toolResult(
        { session },
        status === "completed" ? "已标记为完成。" : "已恢复为阅读中。"
      );
    }
  );

  server.registerTool(
    "delete_reading_session",
    TOOL_CONFIGS.delete_reading_session,
    async ({ sessionId, operationId, deleteCloudSource }) => {
      let cloudResult:
        | {
            cloudSourceDeleted: boolean;
            cloudSourceDeleteError?: string;
          }
        | undefined;
      if (deleteCloudSource && cloudSourceService) {
        const result = await cloudSourceService.deleteCloudSource(sessionId);
        cloudResult = {
          cloudSourceDeleted: result.cloudSourceDeleted,
          ...(result.cloudSourceDeleteError
            ? { cloudSourceDeleteError: result.cloudSourceDeleteError }
            : {})
        };
      }
      const result = await service.deleteSession(sessionId, operationId, {
        deleteCloudSource: false
      });
      const combined = { ...result, ...cloudResult };
      return toolResult(combined, result.deleted ? "这本书的云端阅读数据已删除。" : "这本书已不在书架中。");
    }
  );

  server.registerTool(
    "send_current_context",
    TOOL_CONFIGS.send_current_context,
    async (input) => {
      const { session } = await service.getSessionBundle(input.sessionId);
      const currentPosition = input.currentPosition ?? input.position!;
      const longTermContext = await service.getLayeredReadingContext({
        sessionId: input.sessionId,
        depth: input.readingCommentMode === "deep_analysis" ? "deep" : "daily",
        positionIndex: currentPosition.index
      });
      const context = {
        ...buildCurrentReadingContext(session, input),
        longTermContext
      };
      return toolResult(
        { context },
        `用户正在共读《${session.title}》，位置是${currentPosition.label}。请根据本次主动同步的内容回应。`
      );
    }
  );

  server.registerTool("save_quote", TOOL_CONFIGS.save_quote, async (input) => {
    const annotation = decodeAnnotationQuote(input);
    if (annotation) {
      const saved = await service.createAnnotation({
        sessionId: input.sessionId,
        position: input.position,
        anchor: annotation.anchor,
        author: "user",
        ...(annotation.comment ? { comment: annotation.comment } : {}),
        operationId: input.operationId!
      });
      return toolResult(
        { saved: true, annotation: saved },
        annotation.comment ? "你的划线和评论都留在书边啦。" : "这句话已经划好线。"
      );
    }
    const favoriteCompat = decodeCompatJson(
      input.content,
      input.operationId,
      ANNOTATION_FAVORITE_COMPAT_OPERATION_PREFIX,
      ANNOTATION_FAVORITE_COMPAT_CONTENT_PREFIX
    );
    if (favoriteCompat) {
      const parsed = setAnnotationFavoriteInputSchema.parse({
        ...favoriteCompat,
        sessionId: input.sessionId,
        operationId: input.operationId
      });
      const result = await service.setAnnotationFavorite(parsed);
      return toolResult(
        { saved: true, ...result },
        result.favorite ? "这条共读批注已经收藏。" : "这条共读批注已取消收藏。"
      );
    }
    const memoryCompat = decodeCompatJson(
      input.content,
      input.operationId,
      READING_MEMORY_COMPAT_OPERATION_PREFIX,
      READING_MEMORY_COMPAT_CONTENT_PREFIX
    );
    if (memoryCompat) {
      const parsed = upsertReadingMemoryInputSchema.parse({
        ...memoryCompat,
        sessionId: input.sessionId,
        operationId: input.operationId
      });
      const memory = await service.upsertReadingMemory(parsed);
      return toolResult({ saved: true, memory }, "长期阅读记忆已经保存。" );
    }
    const factCompat = decodeCompatJson(
      input.content,
      input.operationId,
      READING_FACT_COMPAT_OPERATION_PREFIX,
      READING_FACT_COMPAT_CONTENT_PREFIX
    );
    if (factCompat) {
      const parsed = upsertReadingFactInputSchema.parse({
        ...factCompat,
        sessionId: input.sessionId,
        operationId: input.operationId
      });
      const fact = await service.upsertReadingFact(parsed);
      return toolResult({ saved: true, fact }, "阅读事实卡已经保存。" );
    }
    const skillCandidateCompat = decodeCompatJson(
      input.content,
      input.operationId,
      SKILL_CANDIDATE_COMPAT_OPERATION_PREFIX,
      SKILL_CANDIDATE_COMPAT_CONTENT_PREFIX
    );
    if (skillCandidateCompat) {
      const parsed = upsertSkillCandidateInputSchema.parse({
        ...skillCandidateCompat,
        sessionId: input.sessionId,
        operationId: input.operationId
      });
      const skillCandidate = await service.upsertSkillCandidate(parsed);
      return toolResult(
        { saved: true, skillCandidate },
        "读后炼制候选已经保存。"
      );
    }
    const quote = await service.saveQuote(input);
    return toolResult({ saved: true, quote }, "摘录已经放进小窝。");
  });

  server.registerTool("save_reaction", TOOL_CONFIGS.save_reaction, async (input) => {
    const annotationReply = decodeAnnotationReply(input);
    if (annotationReply) {
      const saved = await service.replyToAnnotation({
        sessionId: input.sessionId,
        annotationId: annotationReply.annotationId,
        author: "user",
        text: annotationReply.text,
        operationId: input.operationId!
      });
      return toolResult(
        { saved: true, annotation: saved },
        "回复已经接在这条批注下面。"
      );
    }
    const reaction = await service.saveReaction(input);
    return toolResult({ saved: true, reaction }, "吐槽已经记下。");
  });

  server.registerTool("save_bookmark", TOOL_CONFIGS.save_bookmark, async (input) => {
    const bookmark = await service.saveBookmark(input);
    return toolResult({ saved: true, bookmark }, "书签已经夹好。");
  });

  server.registerTool(
    "finish_today_reading",
    TOOL_CONFIGS.finish_today_reading,
    async (input) => {
      const result = await service.finishToday(input);
      return toolResult(
        { ...result, message: `今天看到${input.position.label}，下次继续。` },
        `今天看到${input.position.label}，下次继续。`
      );
    }
  );

  server.registerTool(
    "complete_reading_session",
    TOOL_CONFIGS.complete_reading_session,
    async ({ sessionId, finalPosition }) => {
      const session = await service.completeSession(sessionId, finalPosition);
      return toolResult({ session, message: `《${session.title}》已经标记为完成。` }, "作品已完成。");
    }
  );

  server.registerTool(
    "generate_diary_context",
    TOOL_CONFIGS.generate_diary_context,
    async ({ sessionId }) => {
      const diaryContext = await service.diaryContext(sessionId);
      return toolResult(
        { diaryContext },
        "日记素材已经整理好。请在聊天里把这些素材写成一篇可复制的小窝日记。"
      );
    }
  );
}

function summarizeCloudSourceManifest(sourceManifest: SourceManifest) {
  return {
    sourceId: sourceManifest.sourceId,
    contentHash: sourceManifest.contentHash,
    ...(sourceManifest.paragraphCount !== undefined
      ? { paragraphCount: sourceManifest.paragraphCount }
      : {}),
    ...(sourceManifest.pageCount !== undefined
      ? { pageCount: sourceManifest.pageCount }
      : {}),
    cloudSync: {
      enabled: sourceManifest.cloudSync.enabled,
      provider: sourceManifest.cloudSync.provider,
      ...(sourceManifest.cloudSync.sizeBytes !== undefined
        ? { sizeBytes: sourceManifest.cloudSync.sizeBytes }
        : {}),
      ...(sourceManifest.cloudSync.mimeType
        ? { mimeType: sourceManifest.cloudSync.mimeType }
        : {})
    }
  };
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function buildCurrentReadingContext(
  session: ReadingSession,
  input: SendCurrentContextInput
) {
  const currentPosition = input.currentPosition ?? input.position!;
  const syncMode = input.currentPageImage
    ? "image"
    : input.currentText || input.selectedText
      ? "text"
      : "description";
  const liveReading = input.mode === "live_reading";
  return {
    sessionId: session.id,
    title: session.title,
    type: session.type,
    previousSyncedPosition:
      input.previousSyncedPosition ?? session.assistantSyncedPosition,
    currentPosition,
    ...(input.contextRange ? { contextRange: input.contextRange } : {}),
    ...(input.includedText ? { includedText: input.includedText } : {}),
    ...(input.currentText ? { currentText: input.currentText } : {}),
    ...(input.selectedText ? { selectedText: input.selectedText } : {}),
    ...(input.pageDescription ? { pageDescription: input.pageDescription } : {}),
    ...(input.userNote ? { userNote: input.userNote } : {}),
    ...(input.currentPageImage ? { currentPageImage: input.currentPageImage } : {}),
    ...(input.sourceContext ? { sourceContext: input.sourceContext } : {}),
    mode: input.mode,
    readingCommentMode: liveReading
      ? "reaction_only"
      : input.readingCommentMode ?? session.sessionPreferences.readingCommentMode,
    commentLength: liveReading
      ? "short"
      : input.commentLength ?? session.sessionPreferences.commentLength,
    ...(input.batch ? { batch: input.batch } : {}),
    syncMode
  };
}
