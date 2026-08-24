import type {
  CompanionComment,
  Quote,
  Reaction,
  ReadingAnnotation,
  ReadingFactCard,
  ReadingMemory,
  ReadingType,
  SkillCandidate,
  SkillForgeVerdict
} from "@ss/shared";

export interface ChapterSnapshot {
  sourceSystem: "ss-reading-nest";
  sessionId: string;
  bookTitle: string;
  readingType: ReadingType;
  scope: "chapter" | "book";
  chapterLabel: string;
  rangeStart: number;
  rangeEnd: number;
  totalUnits?: number;
  body: string;
  highlights: string[];
  annotationThreads: string[];
  reflections: string[];
  memories: string[];
  facts: string[];
  sourceLocations: string[];
  fingerprint: string;
}

export interface SkillForgeDraft {
  verdict: SkillForgeVerdict;
  title: string;
  rationale: string;
  skillName?: string;
  description?: string;
  triggerExamples: string[];
  workflow: string[];
  boundaries: string[];
  sourceNotes: string[];
}

export const SKILL_FORGE_SAMPLING_TOOL = {
  name: "submit_skill_forge_verdict",
  description:
    "Submit exactly one strict P3 reading-forge verdict. Use empty strings and empty arrays for forge-only fields when the verdict is not forge_skill.",
  inputSchema: {
    type: "object" as const,
    properties: {
      verdict: {
        type: "string",
        enum: ["forge_skill", "knowledge_only", "insufficient_coverage"]
      },
      title: { type: "string", description: "Short Chinese verdict title" },
      rationale: { type: "string", description: "Concrete Chinese rationale" },
      skillName: {
        type: "string",
        description: "Lowercase kebab-case for forge_skill, otherwise empty"
      },
      description: {
        type: "string",
        description: "Starts with Use when for forge_skill, otherwise empty"
      },
      triggerExamples: { type: "array", items: { type: "string" } },
      workflow: { type: "array", items: { type: "string" } },
      boundaries: { type: "array", items: { type: "string" } },
      sourceNotes: { type: "array", items: { type: "string" } }
    },
    required: [
      "verdict",
      "title",
      "rationale",
      "skillName",
      "description",
      "triggerExamples",
      "workflow",
      "boundaries",
      "sourceNotes"
    ]
  }
};

export function buildChapterSnapshot(input: {
  sessionId: string;
  bookTitle: string;
  readingType: ReadingType;
  rangeStart: number;
  rangeEnd: number;
  totalUnits?: number;
  body: string;
  annotations: ReadingAnnotation[];
  comments: CompanionComment[];
  quotes: Quote[];
  reactions: Reaction[];
  memories: ReadingMemory[];
  facts: ReadingFactCard[];
}): ChapterSnapshot {
  const inRange = (index: number) => index >= input.rangeStart && index <= input.rangeEnd;
  const scope = input.totalUnits !== undefined && input.rangeEnd >= input.totalUnits
    ? "book"
    : "chapter";
  const chapterLabel = scope === "book"
    ? "全书"
    : input.readingType === "novel"
      ? `第 ${input.rangeStart}–${input.rangeEnd} 段`
      : `第 ${input.rangeStart}–${input.rangeEnd} 页`;
  const highlights = input.annotations
    .filter((item) => inRange(item.position.index))
    .map((item) => `${item.position.label}：${item.anchor.selectedText}`);
  const annotationThreads = input.annotations
    .filter((item) => inRange(item.position.index))
    .flatMap((item) =>
      item.messages.map(
        (message) =>
          `${item.position.label} · ${message.author === "user" ? "小安" : "Daddy"}：${message.text}`
      )
    );
  const reflections = [
    ...input.comments
      .filter((item) => inRange(item.position.index))
      .map((item) => `${item.position.label} · Daddy短评：${item.text}`),
    ...input.reactions
      .filter((item) => inRange(item.position.index))
      .map((item) => `${item.position.label} · 小安：${item.content}`),
    ...input.quotes
      .filter((item) => inRange(item.position.index))
      .map((item) => `${item.position.label} · 摘录：${item.content}`)
  ];
  const memories = input.memories
    .filter((item) => item.status === "active")
    .map((item) => `${item.kind}：${item.content}`);
  const facts = input.facts
    .filter((item) => item.status === "active")
    .map((item) => `${item.subject}：${item.fact}`);
  const sourceLocations = Array.from(
    new Set([
      ...highlights.map((item) => item.split("：", 1)[0]!),
      ...annotationThreads.map((item) => item.split(" · ", 1)[0]!),
      ...reflections.map((item) => item.split(" · ", 1)[0]!)
    ])
  );
  const fingerprintPayload = JSON.stringify({
    version: "p3-v1",
    bookTitle: input.bookTitle.trim(),
    readingType: input.readingType,
    rangeStart: input.rangeStart,
    rangeEnd: input.rangeEnd,
    totalUnits: input.totalUnits,
    body: normalizeText(input.body),
    highlights,
    annotationThreads,
    reflections,
    memories,
    facts
  });
  return {
    sourceSystem: "ss-reading-nest",
    sessionId: input.sessionId,
    bookTitle: input.bookTitle.trim(),
    readingType: input.readingType,
    scope,
    chapterLabel,
    rangeStart: input.rangeStart,
    rangeEnd: input.rangeEnd,
    ...(input.totalUnits !== undefined ? { totalUnits: input.totalUnits } : {}),
    body: input.body,
    highlights,
    annotationThreads,
    reflections,
    memories,
    facts,
    sourceLocations,
    fingerprint: `snapshot-v1-${fnv1a(fingerprintPayload)}`
  };
}

export function buildSkillForgePrompt(
  snapshot: ChapterSnapshot,
  options: { bodyLimit?: number; compact?: boolean; toolName?: string } = {}
): string {
  const body = centerEllipsis(snapshot.body, options.bodyLimit ?? 24_000);
  return [
    "你在执行共读小窝 P3：判断读过的内容是否值得炼成可复用 Skill。",
    "门槛要高：只有能指导未来重复任务的稳定方法、判断框架或工作流才 forge_skill；",
    "只有知识、观点或值得记住的内容则 knowledge_only；材料不足则 insufficient_coverage。",
    "不要因为用户想试功能就硬造 Skill。未读完全书时，不得声称这是全书 Skill。",
    options.toolName
      ? `必须调用 ${options.toolName} 一次提交判定，不要另写答案。工具字段必须是：`
      : "只输出一个 JSON 对象，不要 Markdown 代码围栏。字段必须是：",
    '{"verdict":"forge_skill|knowledge_only|insufficient_coverage","title":"短标题","rationale":"具体判定理由","skillName":"仅 forge_skill，英文小写连字符","description":"仅 forge_skill；以 Use when 开头，写清触发条件","triggerExamples":["用户会怎样问"],"workflow":["可执行步骤"],"boundaries":["不能做什么或何时不触发"],"sourceNotes":["证据与覆盖边界"]}',
    "禁止长篇复制原文；禁止把人物设定、剧情事实冒充通用方法；不确定处必须写进 boundaries/sourceNotes。",
    options.compact && !options.toolName
      ? "这是格式修复重试：所有字段务必简短，整个 JSON 控制在 1200 字以内，JSON 前后不要添加任何文字。"
      : "",
    "",
    `作品：${snapshot.bookTitle}`,
    `覆盖：${snapshot.chapterLabel}${snapshot.totalUnits ? `（${snapshot.rangeEnd}/${snapshot.totalUnits}）` : ""}`,
    `候选范围：${snapshot.scope === "book" ? "全书" : "当前阅读范围"}`,
    `稳定指纹：${snapshot.fingerprint}`,
    section("正文样本", body || "（无正文）"),
    section("划线", snapshot.highlights.join("\n")),
    section("书边对话", snapshot.annotationThreads.join("\n")),
    section("共同阅读反应", snapshot.reflections.join("\n")),
    section("已有长期记忆", snapshot.memories.join("\n")),
    section("已有事实卡", snapshot.facts.join("\n"))
  ].filter(Boolean).join("\n");
}

export function buildSkillForgeConversationPrompt(snapshot: ChapterSnapshot): string {
  const fixed = {
    sessionId: snapshot.sessionId,
    scope: snapshot.scope,
    chapterLabel: snapshot.chapterLabel,
    rangeStart: snapshot.rangeStart,
    rangeEnd: snapshot.rangeEnd,
    ...(snapshot.totalUnits !== undefined ? { totalUnits: snapshot.totalUnits } : {}),
    analysisFingerprint: snapshot.fingerprint,
    status: "draft",
    operationId: `skill-candidate-v36:${snapshot.fingerprint}`
  };
  return [
    buildSkillForgePrompt(snapshot, {
      bodyLimit: 12_000,
      toolName: "upsert_skill_candidate"
    }),
    "当前页面宿主没有返回可用的采样结果。现在请在本轮对话中完成判定，并且必须调用 upsert_skill_candidate 恰好一次保存最终结果。不要调用 save_quote。",
    `以下字段固定照抄：${JSON.stringify(fixed)}`,
    "其余字段按上面的严格门槛填写。forge_skill 时必须同时提供合法的 skillName、以 Use when 开头的 description，以及完整可审阅的 skillMarkdown；另外两种 verdict 不要伪造 Skill 字段。",
    "工具成功后，用一句简短中文告诉用户判定是：可炼成 Skill、只适合知识卡，或材料不足。"
  ].join("\n\n");
}

export function parseSkillForgeDraft(raw: string): SkillForgeDraft | null {
  try {
    const json = extractFirstJsonObject(stripFence(raw));
    if (!json) return null;
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const verdict = normalizeVerdict(parsed.verdict);
    if (
      verdict !== "forge_skill" &&
      verdict !== "knowledge_only" &&
      verdict !== "insufficient_coverage"
    ) return null;
    const title = cleanString(parsed.title, 200);
    const rationale = cleanString(parsed.rationale, 2_000);
    if (!title || !rationale) return null;
    const draft: SkillForgeDraft = {
      verdict,
      title,
      rationale,
      triggerExamples: cleanList(parsed.triggerExamples, 12, 300),
      workflow: cleanList(parsed.workflow, 20, 500),
      boundaries: cleanList(parsed.boundaries, 20, 500),
      sourceNotes: cleanList(parsed.sourceNotes, 20, 500)
    };
    if (verdict !== "forge_skill") return draft;
    const skillName = slugify(cleanString(parsed.skillName, 64));
    const description = cleanString(parsed.description, 900);
    if (!skillName || !description || draft.workflow.length === 0) return null;
    return {
      ...draft,
      skillName,
      description: description.startsWith("Use when")
        ? description
        : `Use when the user asks for this reusable reading-derived workflow. ${description}`
    };
  } catch {
    return null;
  }
}

export function toPersistedSkillCandidate(
  snapshot: ChapterSnapshot,
  draft: SkillForgeDraft
): Omit<SkillCandidate, "id" | "sessionId" | "operationId" | "createdAt" | "updatedAt"> {
  const skillMarkdown = draft.verdict === "forge_skill"
    ? buildSkillMarkdown(draft)
    : undefined;
  return {
    scope: snapshot.scope,
    chapterLabel: snapshot.chapterLabel,
    rangeStart: snapshot.rangeStart,
    rangeEnd: snapshot.rangeEnd,
    ...(snapshot.totalUnits !== undefined ? { totalUnits: snapshot.totalUnits } : {}),
    verdict: draft.verdict,
    title: draft.title,
    rationale: draft.rationale,
    ...(draft.skillName ? { skillName: draft.skillName } : {}),
    ...(draft.description ? { description: draft.description } : {}),
    triggerExamples: draft.triggerExamples,
    workflow: draft.workflow,
    boundaries: draft.boundaries,
    sourceNotes: [
      `来源：《${snapshot.bookTitle}》${snapshot.chapterLabel}`,
      `指纹：${snapshot.fingerprint}`,
      ...draft.sourceNotes
    ],
    ...(skillMarkdown ? { skillMarkdown } : {}),
    analysisFingerprint: snapshot.fingerprint,
    generatorVersion: "p3-v1",
    status: "draft"
  };
}

export function buildSkillMarkdown(draft: SkillForgeDraft): string {
  if (draft.verdict !== "forge_skill" || !draft.skillName || !draft.description) return "";
  const list = (items: string[]) => items.length
    ? items.map((item) => `- ${item}`).join("\n")
    : "- 暂无。";
  return [
    "---",
    `name: ${draft.skillName}`,
    `description: ${JSON.stringify(draft.description)}`,
    "---",
    "",
    `# ${draft.title}`,
    "",
    draft.rationale,
    "",
    "## Trigger examples",
    "",
    list(draft.triggerExamples),
    "",
    "## Workflow",
    "",
    draft.workflow.map((item, index) => `${index + 1}. ${item}`).join("\n"),
    "",
    "## Boundaries",
    "",
    list(draft.boundaries),
    "",
    "## Source notes",
    "",
    list(draft.sourceNotes)
  ].join("\n");
}

function section(title: string, value: string): string {
  return `\n【${title}】\n${value || "（无）"}`;
}

function normalizeText(value: string): string {
  return value.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").trim();
}

function centerEllipsis(value: string, limit: number): string {
  if (value.length <= limit) return value;
  const side = Math.floor((limit - 80) / 2);
  return `${value.slice(0, side)}\n\n…（中间正文为控制额度省略）…\n\n${value.slice(-side)}`;
}

function stripFence(value: string): string {
  const trimmed = value.trim();
  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

function extractFirstJsonObject(value: string): string | null {
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]!;
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }
    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === "{") {
      if (depth === 0) start = index;
      depth += 1;
      continue;
    }
    if (character === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) return value.slice(start, index + 1);
    }
  }
  return null;
}

function normalizeVerdict(value: unknown): SkillForgeVerdict | null {
  if (
    value === "forge_skill" ||
    value === "knowledge_only" ||
    value === "insufficient_coverage"
  ) return value;
  if (value === "值得炼成 Skill" || value === "值得炼成Skill") return "forge_skill";
  if (value === "更适合知识卡") return "knowledge_only";
  if (value === "材料还不够") return "insufficient_coverage";
  return null;
}

function cleanString(value: unknown, limit: number): string {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function cleanList(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanString(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "");
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
