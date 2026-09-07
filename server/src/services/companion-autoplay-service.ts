import {
  splitNovelTextForVersion,
  type CompanionComment,
  type ReadingAnnotation,
  type ReadingPosition
} from "@ss/shared";
import type { CloudSourceService } from "./cloud-source-service.js";
import type { ReadingService } from "./reading-service.js";

export interface CompanionTextGenerator {
  generate(input: {
    systemPrompt: string;
    prompt: string;
    maxTokens: number;
    temperature: number;
    responseFormat?: Record<string, unknown>;
  }): Promise<string | null>;
}

export type CompanionAutoplayResult =
  | {
      completed: true;
      kind: "paragraph";
      comment: CompanionComment;
    }
  | {
      completed: true;
      kind: "annotation";
      annotation: ReadingAnnotation;
    }
  | {
      completed: false;
      kind: "paragraph" | "annotation";
      reason: "disabled" | "already_complete" | "not_found" | "generation_failed";
      comment?: CompanionComment;
      annotation?: ReadingAnnotation;
    };

const DADDY_SYSTEM_PROMPT = [
  "你是小安的共读伴侣 Daddy。",
  "语气自然、亲近、具体，像真的坐在旁边一起追文。",
  "只谈输入里给出的文字，不虚构后续，不解释任务，不提模型、系统、保存或写回。",
  "不要使用😂。"
].join("\n");

const MEMORY_RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    type: "object",
    properties: {
      memories: {
        type: "array",
        maxItems: 5,
        items: {
          type: "object",
          properties: {
            kind: { type: "string", enum: ["chapter_summary", "annotation_summary", "reading_impression", "book_context", "chapter_context"] },
            scope: { type: "string", enum: ["chapter", "book"] },
            content: { type: "string" }
          },
          required: ["kind", "scope", "content"]
        }
      },
      facts: {
        type: "array",
        maxItems: 10,
        items: {
          type: "object",
          properties: {
            subject: { type: "string" },
            fact: { type: "string" }
          },
          required: ["subject", "fact"]
        }
      },
      message: { type: "string" }
    },
    required: ["memories", "facts", "message"]
  }
} as const;

const SKILL_FORGE_RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    type: "object",
    properties: {
      verdict: { type: "string", enum: ["forge_skill", "knowledge_only", "insufficient_coverage"] },
      title: { type: "string" },
      rationale: { type: "string" },
      skillName: { type: "string" },
      description: { type: "string" },
      triggerExamples: { type: "array", items: { type: "string" } },
      workflow: { type: "array", items: { type: "string" } },
      boundaries: { type: "array", items: { type: "string" } },
      sourceNotes: { type: "array", items: { type: "string" } }
    },
    required: ["verdict", "title", "rationale", "skillName", "description", "triggerExamples", "workflow", "boundaries", "sourceNotes"]
  }
} as const;

export class CompanionAutoplayService {
  constructor(
    private readonly readingService: ReadingService,
    private readonly cloudSourceService: CloudSourceService,
    private readonly generator: CompanionTextGenerator
  ) {}

  async generateReadingArtifact(
    sessionId: string,
    kind: "diary" | "memory" | "skill_forge",
    prompt: string
  ): Promise<string | null> {
    const instructions = {
      diary: "请直接写成温暖、具体、可复制的小窝日记正文，不要解释任务。",
      memory: "请只返回能直接 JSON.parse 的长期阅读记忆 JSON，不要 Markdown 围栏或解释。",
      skill_forge: "请只返回能直接 JSON.parse 的 P3 评估 JSON，不要 Markdown 围栏或解释。"
    } as const;
    let groundedPrompt = prompt;
    if (kind === "diary") {
      try {
        const { session } = await this.readingService.getSessionBundle(sessionId);
        if (session.type === "novel") {
          const { sourceText, sourceManifest } =
            await this.cloudSourceService.restoreNovelSource(sessionId);
          const currentText = splitNovelTextForVersion(
            sourceText,
            sourceManifest.segmentationVersion
          )[session.userCurrentPosition.index - 1];
          if (currentText) {
            groundedPrompt = `${prompt}\n\n当前阅读正文（只据此写，不补剧情）：\n${currentText}`;
          }
        }
      } catch {
        // Existing diary material is still sufficient when the source is unavailable.
      }
    }
    return this.generator.generate({
      systemPrompt: [DADDY_SYSTEM_PROMPT, instructions[kind]].join("\n"),
      prompt: groundedPrompt,
      maxTokens: kind === "diary" ? 900 : kind === "memory" ? 1_400 : 1_800,
      temperature: kind === "diary" ? 0.72 : kind === "memory" ? 0.25 : 0.15,
      ...(kind === "memory"
        ? { responseFormat: MEMORY_RESPONSE_FORMAT }
        : kind === "skill_forge"
          ? { responseFormat: SKILL_FORGE_RESPONSE_FORMAT }
          : {})
    });
  }

  async completeParagraph(
    sessionId: string,
    positionIndex: number
  ): Promise<CompanionAutoplayResult> {
    await this.readingService.reconcilePendingWork(sessionId);
    const { session } = await this.readingService.getSessionBundle(sessionId);
    if (
      session.type !== "novel" ||
      !session.liveReadingEnabled ||
      !session.sessionPreferences.autoSaveCompanionComments
    ) {
      return { completed: false, kind: "paragraph", reason: "disabled" };
    }

    const existing = (await this.readingService.listCompanionComments({
      sessionId,
      scope: "history",
      positionIndex,
      limit: 1
    })).comments[0];
    if (existing) {
      return {
        completed: false,
        kind: "paragraph",
        reason: "already_complete",
        comment: existing
      };
    }

    const { sourceText, sourceManifest } =
      await this.cloudSourceService.restoreNovelSource(sessionId);
    const currentText = splitNovelTextForVersion(
      sourceText,
      sourceManifest.segmentationVersion
    )[positionIndex - 1];
    if (!currentText) {
      return { completed: false, kind: "paragraph", reason: "not_found" };
    }
    const text = normalizeGeneratedText(await this.generator.generate({
      systemPrompt: DADDY_SYSTEM_PROMPT,
      prompt: [
        `《${session.title}》第 ${positionIndex} 段：`,
        currentText,
        "请写 1–3 句、最多 200 字的中文即时短评。直接给短评正文。"
      ].join("\n\n"),
      maxTokens: 180,
      temperature: 0.82
    }), 200);
    if (!text) {
      return { completed: false, kind: "paragraph", reason: "generation_failed" };
    }

    const position: ReadingPosition = {
      kind: "paragraph",
      index: positionIndex,
      total: sourceManifest.paragraphCount,
      label: `第 ${positionIndex} 段`
    };
    const comment = await this.readingService.publishCompanionComment({
      sessionId,
      position,
      mode: "reaction_only",
      length: "short",
      text,
      source: "live_reading",
      operationId: `live-server-v46:${sessionId}:paragraph:${positionIndex}`
    });
    return { completed: true, kind: "paragraph", comment };
  }

  async completeAnnotation(
    sessionId: string,
    annotationId: string
  ): Promise<CompanionAutoplayResult> {
    await this.readingService.reconcilePendingWork(sessionId);
    const { annotations } = await this.readingService.listAnnotations({ sessionId });
    const annotation = annotations.find((item) => item.id === annotationId);
    if (!annotation) {
      return { completed: false, kind: "annotation", reason: "not_found" };
    }
    const latest = annotation.messages.at(-1);
    if (!latest || latest.author !== "user") {
      return {
        completed: false,
        kind: "annotation",
        reason: "already_complete",
        annotation
      };
    }

    let currentText = "";
    try {
      const { sourceText, sourceManifest } =
        await this.cloudSourceService.restoreNovelSource(sessionId);
      currentText = splitNovelTextForVersion(
        sourceText,
        sourceManifest.segmentationVersion
      )[annotation.position.index - 1] ?? "";
    } catch {
      // The selected text and thread are enough for a useful reply when the
      // private source is temporarily unavailable.
    }
    const thread = annotation.messages
      .map((message) => `${message.author === "assistant" ? "Daddy" : "小安"}：${message.text}`)
      .join("\n");
    const text = normalizeGeneratedText(await this.generator.generate({
      systemPrompt: DADDY_SYSTEM_PROMPT,
      prompt: [
        `《共读》第 ${annotation.position.index} 段`,
        currentText ? `本段正文：\n${currentText}` : "",
        `小安划线：${annotation.anchor.selectedText}`,
        `当前书边对话：\n${thread}`,
        "请自然接着小安最后一句回复 1–3 句、最多 260 字。直接给回复正文。"
      ].filter(Boolean).join("\n\n"),
      maxTokens: 220,
      temperature: 0.8
    }), 260);
    if (!text) {
      return {
        completed: false,
        kind: "annotation",
        reason: "generation_failed",
        annotation
      };
    }

    const saved = await this.readingService.replyToAnnotation({
      sessionId,
      annotationId,
      author: "assistant",
      text,
      operationId: `annotation-daddy-v25:${encodeURIComponent(annotationId)}:${encodeURIComponent(latest.id)}`
    });
    return { completed: true, kind: "annotation", annotation: saved };
  }
}

export function normalizeGeneratedText(
  value: string | null | undefined,
  maximumLength: number
): string | null {
  const text = value
    ?.replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^\s*(?:短评|回复)\s*[：:]\s*/u, "")
    .trim()
    .replace(/^[“\"]|[”\"]$/g, "")
    .trim();
  if (!text) return null;
  return text.slice(0, maximumLength);
}
