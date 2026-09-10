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
    "正文是事实的唯一证据；批注、Daddy短评和现有记忆都只用于整理共同印象或避免重复，不能证明事实。",
    "严格区分：正文明确陈述的事实、角色自己的误会、以及读者猜测。误会和猜测绝不能写进 facts。",
    "返回严格 JSON，不要 Markdown、代码围栏或解释。格式：",
    JSON.stringify({
      memories: [
        { kind: "chapter_summary", scope: "chapter", content: "本段发生了什么" },
        { kind: "annotation_summary", scope: "chapter", content: "共同关注和批注线索" },
        { kind: "reading_impression", scope: "chapter", content: "两人共读时的稳定印象" },
        { kind: "chapter_context", scope: "chapter", content: "下次继续所需前情" }
      ],
      facts: [{ subject: "具体人物或线索", fact: "稳定、未来有用且由正文明确陈述的事实", evidence: "从本次正文逐字复制的证据短句" }],
      message: "一句自然、简短的完成提示"
    }),
    "memories 最多 5 条；reading_impression 必须写成感受而不是事实断言。",
    "facts 最多 10 条，每条 evidence 必须是本次正文中能逐字找到的 4–100 字原句；找不到原句、只来自旧卡或需要推断时就不要保存，没有可靠事实可返回空数组。",
    `范围：${input.rangeStart}–${input.rangeEnd}`,
    `正文：\n${input.text}`,
    `本段批注：\n${JSON.stringify(input.annotations)}`,
    `本段Daddy短评：\n${JSON.stringify(input.companionComments)}`,
    `现有有效记忆（用于避免重复）：\n${JSON.stringify(input.activeMemories)}`,
    `现有有效事实（用于避免重复）：\n${JSON.stringify(input.activeFacts)}`
  ].join("\n\n");
}

export function parseReadingMemoryCaptureDraft(
  text: string,
  evidenceSource?: string
): ReadingMemoryCaptureDraft | null {
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
          const evidence = typeof value.evidence === "string" ? value.evidence.trim() : "";
          const evidenceValid = evidenceSource === undefined || (
            normalizeEvidence(evidence).length >= 4 &&
            normalizeEvidence(evidenceSource).includes(normalizeEvidence(evidence))
          );
          return subject && fact && evidenceValid
            ? [{
                subject: subject.slice(0, 200),
                fact: fact.slice(0, 2_000)
              }]
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

function normalizeEvidence(value: string): string {
  return value.replace(/[\s“”‘’「」『』《》]/g, "");
}
