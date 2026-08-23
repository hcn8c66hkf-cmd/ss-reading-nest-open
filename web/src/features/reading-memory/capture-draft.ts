import type {
  CompanionComment,
  ReadingAnnotation,
  ReadingFactCard,
  ReadingMemory
} from "@ss/shared";

const MEMORY_KINDS = new Set<ReadingMemory["kind"]>([
  "chapter_summary",
  "annotation_summary",
  "reading_impression",
  "book_context",
  "chapter_context"
]);

export type ReadingMemoryCaptureDraft = {
  memories: Array<{
    kind: ReadingMemory["kind"];
    scope: ReadingMemory["scope"];
    content: string;
  }>;
  facts: Array<{
    subject: string;
    fact: string;
  }>;
  message?: string;
};

export function buildReadingMemoryCapturePrompt(input: {
  title: string;
  chapterLabel: string;
  rangeStart: number;
  rangeEnd: number;
  text: string;
  annotations: ReadingAnnotation[];
  companionComments: CompanionComment[];
  activeMemories: ReadingMemory[];
  activeFacts: ReadingFactCard[];
}): string {
  return [
    `请为《${input.title}》${input.chapterLabel}整理可长期复用的共读记忆。`,
    "只依据提供的正文、批注和短评，不补写未出现的剧情。",
    "返回严格 JSON，不要 Markdown、代码围栏或解释。格式：",
    JSON.stringify({
      memories: [
        { kind: "chapter_summary", scope: "chapter", content: "本段发生了什么" },
        { kind: "annotation_summary", scope: "chapter", content: "共同关注和批注线索" },
        { kind: "reading_impression", scope: "chapter", content: "两人共读时的稳定印象" },
        { kind: "chapter_context", scope: "chapter", content: "下次继续所需前情" }
      ],
      facts: [{ subject: "人物或线索", fact: "稳定、未来有用且有正文依据的事实" }],
      message: "一句自然、简短的完成提示"
    }),
    "memories 最多 5 条；facts 只留人物、关系、设定或未决伏笔，最多 10 条，没有就返回空数组。",
    `范围：${input.rangeStart}–${input.rangeEnd}`,
    `正文：\n${input.text}`,
    `本段批注：\n${JSON.stringify(input.annotations)}`,
    `本段Daddy短评：\n${JSON.stringify(input.companionComments)}`,
    `现有有效记忆（用于避免重复）：\n${JSON.stringify(input.activeMemories)}`,
    `现有有效事实（用于避免重复）：\n${JSON.stringify(input.activeFacts)}`
  ].join("\n\n");
}

export function parseReadingMemoryCaptureDraft(text: string): ReadingMemoryCaptureDraft | null {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const source = parsed as Record<string, unknown>;
  const memories = Array.isArray(source.memories)
    ? source.memories
        .flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const value = item as Record<string, unknown>;
          const kind = value.kind;
          const content = typeof value.content === "string" ? value.content.trim() : "";
          if (typeof kind !== "string" || !MEMORY_KINDS.has(kind as ReadingMemory["kind"]) || !content) {
            return [];
          }
          const normalizedKind = kind as ReadingMemory["kind"];
          return [{
            kind: normalizedKind,
            scope: normalizedKind === "book_context" ? "book" as const : "chapter" as const,
            content: content.slice(0, 4_000)
          }];
        })
        .slice(0, 5)
    : [];
  const facts = Array.isArray(source.facts)
    ? source.facts
        .flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const value = item as Record<string, unknown>;
          const subject = typeof value.subject === "string" ? value.subject.trim() : "";
          const fact = typeof value.fact === "string" ? value.fact.trim() : "";
          return subject && fact
            ? [{ subject: subject.slice(0, 200), fact: fact.slice(0, 2_000) }]
            : [];
        })
        .slice(0, 10)
    : [];
  if (memories.length === 0 && facts.length === 0) return null;
  return {
    memories,
    facts,
    ...(typeof source.message === "string" && source.message.trim()
      ? { message: source.message.trim().slice(0, 240) }
      : {})
  };
}
