import {
  novelReadingUnitLabel,
  splitNovelTextForVersion,
  type CommentLength,
  type CompanionComment,
  type ReadingAnnotation,
  type ReadingCommentMode,
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
  "语气自然、亲近、具体，像真的坐在小安旁边一起追文，不是在扮演一种固定的‘吐槽人格’。",
  "先诚实回应这一段真正引起的感觉：可以喜欢、心疼、笑、嗑、疑惑、分析，也可以在确有槽点时骂或阴阳；没有槽点就不要硬挑刺。",
  "风格选项只是一点轻微偏好，不能压过你对本段的真实反应；不要为了显得尖锐而寻找攻击对象或给人物下定论。",
  "分清正文事实、角色误会和自己的猜测；不确定就用疑问或保留语气，不捏造动机。",
  "只谈输入里给出的文字，不虚构后续，不解释任务，不提模型、系统、保存或写回。",
  "不要使用😂。"
].join("\n");

const READING_MODE_INSTRUCTIONS: Record<ReadingCommentMode, string> = {
  light_chat: "自由陪读：说你此刻最真实、最自然的反应，亲近、松弛，可以偏心、开玩笑、认真或安静接一句，不写书评。",
  reaction_only: "吐槽一下：只是让回应更即时、更短，不代表必须找槽点；有槽就自然吐，没有就说真正注意到的东西。",
  cp_talk: "嗑一下：盯住人物之间的暧昧、拉扯和糖点，兴奋一点；没有糖就直说，别硬嗑。",
  plot_guess: "猜后续：顺着眼前伏笔大胆猜一两步，明确是猜测，不把猜测冒充后文或剧透。",
  deep_analysis: "认真分析：具体分析这一段的动机、结构或伏笔，但仍像和小安聊天，不用论文腔和空泛套话。",
  diary_summary: "写读书日记：记住小安和Daddy此刻的反应与气氛，剧情最多带过一句，不做章节复述。"
};

function reactionSystemPrompt(mode: ReadingCommentMode) {
  return [
    DADDY_SYSTEM_PROMPT,
    "你现在是在和小安追文、接她的话，不是在完成阅读理解。",
    READING_MODE_INSTRUCTIONS[mode],
    "用日常口语和短句；除非选了认真分析，否则不要用‘这体现了’‘这说明’‘可以看出’一类分析腔。"
  ].join("\n");
}

function commentBudget(length: CommentLength) {
  if (length === "short") return { sentences: "1–2", characters: 100, tokens: 160 };
  if (length === "long") return { sentences: "3–6", characters: 420, tokens: 560 };
  return { sentences: "2–4", characters: 220, tokens: 320 };
}

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
            fact: { type: "string" },
            evidence: { type: "string" }
          },
          required: ["subject", "fact", "evidence"]
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
      diary: [
        "请写 Daddy 和小安今晚一起追文留下的私人日记片段，不要解释任务。",
        "硬规则：剧情交代最多一句；其余只写小安留下的原话或反应、Daddy当时想接的话，以及两个人读到这里的气氛。",
        "没有足够的共同反应就宁愿写短，绝对不要拿剧情转述凑字数。",
        "不要写读后感、书评、章节总结或起承转合作文；禁用‘今天我们读到’‘让我感受到’‘这段情节’‘作者通过’等套话。",
        "以 Daddy 的第一人称写给小安，像睡前翻到这页随手记两笔：口语、偏心、有停顿，约 120–260 字。"
      ].join("\n"),
      memory: "请只返回能直接 JSON.parse 的长期阅读记忆 JSON，不要 Markdown 围栏或解释。",
      skill_forge: "请只返回能直接 JSON.parse 的 P3 评估 JSON，不要 Markdown 围栏或解释。"
    } as const;
    let groundedPrompt = prompt;
    if (kind === "diary") {
      try {
        const [context, annotationResult, commentResult] = await Promise.all([
          this.readingService.diaryContext(sessionId),
          this.readingService.listAnnotations({ sessionId }),
          this.readingService.listCompanionComments({
            sessionId,
            scope: "history",
            limit: 20
          })
        ]);
        const cutoff = Date.now() - 24 * 60 * 60 * 1_000;
        const recent = (createdAt: string) => new Date(createdAt).getTime() >= cutoff;
        const threads = annotationResult.annotations.flatMap((annotation) =>
          annotation.messages
            .filter((message) => recent(message.createdAt))
            .map((message) =>
              `${annotation.position.label} · ${message.author === "user" ? "小安" : "Daddy"}：${message.text}`
            )
        );
        const comments = commentResult.comments
          .filter((comment) => recent(comment.createdAt))
          .map((comment) => `${comment.position.label} · Daddy：${comment.text}`);
        const material = [
          ...context.quotes.map((item) => `${item.position.label} · 小安摘录：${item.content}`),
          ...context.reactions.map((item) => `${item.position.label} · 小安：${item.content}`),
          ...threads,
          ...comments
        ].slice(-24);
        groundedPrompt = [
          `作品：《${context.session.title}》`,
          `今天读到：${context.userCurrentPosition.label}`,
          "下面只有今天的小窝互动，不提供章节正文，也不允许补写剧情：",
          material.length ? material.join("\n") : "（今天没有留下足够互动，请只写两三句很短的陪伴记录。）",
          "根据这些互动写日记；不要总结作品内容。"
        ].join("\n\n");
      } catch {
        groundedPrompt = "今天没有拿到足够的小窝互动。请只写两三句很短的陪伴记录，不要总结或虚构剧情。";
      }
    }
    let generated: string | null = null;
    try {
      generated = await this.generator.generate({
        systemPrompt: [DADDY_SYSTEM_PROMPT, instructions[kind]].join("\n"),
        prompt: groundedPrompt,
        maxTokens: kind === "diary" ? 420 : kind === "memory" ? 1_400 : 1_800,
        temperature: kind === "diary" ? 0.88 : kind === "memory" ? 0.2 : 0.15,
        ...(kind === "memory"
          ? { responseFormat: MEMORY_RESPONSE_FORMAT }
          : kind === "skill_forge"
            ? { responseFormat: SKILL_FORGE_RESPONSE_FORMAT }
            : {})
      });
    } catch (error) {
      if (kind !== "skill_forge") throw error;
    }
    return kind === "skill_forge"
      ? normalizeSkillForgeArtifact(generated)
      : generated;
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
    const currentChunks = splitNovelTextForVersion(
      sourceText,
      sourceManifest.segmentationVersion
    );
    const currentText = currentChunks[positionIndex - 1];
    if (!currentText) {
      return { completed: false, kind: "paragraph", reason: "not_found" };
    }
    const mode = session.sessionPreferences.readingCommentMode;
    const length = session.sessionPreferences.commentLength;
    const budget = commentBudget(length);
    const text = normalizeGeneratedText(await this.generator.generate({
      systemPrompt: reactionSystemPrompt(mode),
      prompt: [
        `《${session.title}》${novelReadingUnitLabel(currentText, positionIndex)}：`,
        currentText,
        `按“${READING_MODE_INSTRUCTIONS[mode]}”回应 ${budget.sentences} 句、最多 ${budget.characters} 字。直接给正文。`
      ].join("\n\n"),
      maxTokens: budget.tokens,
      temperature: 0.68
    }), budget.characters);
    if (!text) {
      return { completed: false, kind: "paragraph", reason: "generation_failed" };
    }

    const position: ReadingPosition = {
      kind: "paragraph",
      index: positionIndex,
      total: sourceManifest.paragraphCount,
      label: novelReadingUnitLabel(currentText, positionIndex)
    };
    const comment = await this.readingService.publishCompanionComment({
      sessionId,
      position,
      mode,
      length,
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
    const [{ session }, { annotations }] = await Promise.all([
      this.readingService.getSessionBundle(sessionId),
      this.readingService.listAnnotations({ sessionId })
    ]);
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
    const mode = session.sessionPreferences.readingCommentMode;
    const budget = commentBudget(session.sessionPreferences.commentLength);
    const text = normalizeGeneratedText(await this.generator.generate({
      systemPrompt: reactionSystemPrompt(mode),
      prompt: [
        `《共读》第 ${annotation.position.index} 段`,
        currentText ? `本段正文：\n${currentText}` : "",
        `小安划线：${annotation.anchor.selectedText}`,
        `当前书边对话：\n${thread}`,
        `请贴着小安最后一句直接接话，并带出“${READING_MODE_INSTRUCTIONS[mode]}”的感觉。回 ${budget.sentences} 句、最多 ${budget.characters} 字。直接给正文。`
      ].filter(Boolean).join("\n\n"),
      maxTokens: budget.tokens,
      temperature: 0.68
    }), budget.characters);
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

function normalizeSkillForgeArtifact(raw: string | null): string {
  const fallback = () => JSON.stringify({
    verdict: "insufficient_coverage",
    title: "这次先不硬炼",
    rationale: "这次没有拿到足够完整、可核验的判定，先保守记为材料不足；继续读后可以重新评估。",
    skillName: "",
    description: "",
    triggerExamples: [],
    workflow: [],
    boundaries: [],
    sourceNotes: []
  });
  if (!raw) return fallback();
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end <= start) return fallback();
    const parsed = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
    const verdict = normalizeSkillVerdict(parsed.verdict);
    if (!verdict) return fallback();

    const list = (value: unknown) => Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
          .map((item) => item.trim())
      : [];
    const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
    const workflow = list(parsed.workflow);
    const skillName = text(parsed.skillName)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const description = text(parsed.description);
    const completeSkill = verdict === "forge_skill" && skillName && description && workflow.length;
    const safeVerdict = verdict === "forge_skill" && !completeSkill ? "knowledge_only" : verdict;
    const defaults = safeVerdict === "knowledge_only"
      ? {
          title: "更适合留作阅读印象",
          rationale: "这部分有值得记住的内容，但还没有形成可反复调用的稳定方法。"
        }
      : safeVerdict === "insufficient_coverage"
        ? {
            title: "目前材料还不够",
            rationale: "当前已读内容还不足以判断是否存在可复用的方法，继续读后再评估更可靠。"
          }
        : {
            title: "值得炼成可复用方法",
            rationale: "当前材料已经呈现出可迁移到类似任务中的稳定步骤。"
          };

    return JSON.stringify({
      verdict: safeVerdict,
      title: text(parsed.title) || defaults.title,
      rationale: text(parsed.rationale) || defaults.rationale,
      skillName: safeVerdict === "forge_skill" ? skillName : "",
      description: safeVerdict === "forge_skill" ? description : "",
      triggerExamples: safeVerdict === "forge_skill" ? list(parsed.triggerExamples) : [],
      workflow: safeVerdict === "forge_skill" ? workflow : [],
      boundaries: list(parsed.boundaries),
      sourceNotes: list(parsed.sourceNotes)
    });
  } catch {
    return fallback();
  }
}

function normalizeSkillVerdict(value: unknown) {
  if (value === "forge_skill" || value === "knowledge_only" || value === "insufficient_coverage") {
    return value;
  }
  if (value === "值得炼成 Skill" || value === "值得炼成Skill") return "forge_skill";
  if (value === "更适合知识卡" || value === "知识卡") return "knowledge_only";
  if (value === "材料还不够" || value === "材料不足") return "insufficient_coverage";
  return null;
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
