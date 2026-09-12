import { NOVEL_SEGMENTATION_VERSION } from "./models.js";

const LEGACY_TARGET_READING_UNIT_CHARS = 1_800;
const LEGACY_MAX_READING_UNIT_CHARS = 2_000;
const TARGET_CHAPTER_PART_CHARS = 10_000;
const MAX_CHAPTER_CHARS = 12_000;

export function splitNovelText(sourceText: string): string[] {
  const normalized = sourceText.replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");
  const chapters: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (isChapterHeading(trimmed) && current.some((item) => item.trim())) {
      chapters.push(normalizeChapterText(current.join("\n")));
      current = [trimmed];
      continue;
    }
    current.push(line);
  }
  if (current.some((item) => item.trim())) chapters.push(normalizeChapterText(current.join("\n")));

  return chapters.filter(Boolean).flatMap((chapter) => splitOversizedChapter(chapter));
}

function normalizeChapterText(value: string): string {
  return value
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim()
    .replace(/\n[ \t]*\n+/g, "\n\n");
}

export function splitNovelTextV3(sourceText: string): string[] {
  const paragraphs = sourceText
    .replace(/\r\n?/g, "\n")
    .split(/\n[ \t]*\n+/)
    .flatMap((chunk) => splitBySectionHeadings(chunk))
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  return mergeShortUnits(paragraphs).flatMap((chunk) => splitLongUnit(chunk));
}

export function splitNovelTextLegacy(sourceText: string): string[] {
  return sourceText
    .replace(/\r\n?/g, "\n")
    .split(/\n[ \t]*\n+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
}

export function splitNovelTextForVersion(sourceText: string, segmentationVersion: number): string[] {
  if (segmentationVersion < 3) return splitNovelTextLegacy(sourceText);
  if (segmentationVersion === 3) return splitNovelTextV3(sourceText);
  return splitNovelText(sourceText);
}

export function novelReadingUnitLabel(chunk: string, index: number): string {
  const heading = chunk.split("\n", 1)[0]?.trim() ?? "";
  return isChapterHeading(heading) ? heading.slice(0, 60) : `第 ${index} 章`;
}

export function buildNovelSegmentationIndexMap(
  sourceText: string,
  fromVersion: number
): { oldChunks: string[]; newChunks: string[]; oldToNew: number[] } {
  const oldChunks = splitNovelTextForVersion(sourceText, fromVersion);
  const newChunks = splitNovelText(sourceText);
  const newEnds: number[] = [];
  let newCursor = 0;
  for (const chunk of newChunks) {
    newCursor += meaningfulLength(chunk);
    newEnds.push(newCursor);
  }

  let oldCursor = 0;
  const oldToNew = oldChunks.map((chunk) => {
    oldCursor += meaningfulLength(chunk);
    const target = newEnds.findIndex((end) => end >= oldCursor);
    return Math.max(1, (target < 0 ? newChunks.length - 1 : target) + 1);
  });
  return { oldChunks, newChunks, oldToNew };
}

function meaningfulLength(value: string): number {
  return value.replace(/\s/g, "").length;
}

function splitBySectionHeadings(chunk: string): string[] {
  const lines = chunk.replace(/\r\n?/g, "\n").split("\n");
  const units: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (isSectionHeading(trimmed) && current.length > 0) {
      units.push(current.join("\n"));
      current = [trimmed];
      continue;
    }
    current.push(trimmed);
  }

  if (current.length > 0) units.push(current.join("\n"));
  return units;
}

function isSectionHeading(line: string): boolean {
  return (
    /^第\s*[0-9０-９一二两三四五六七八九十百千万〇零]+\s*[章节卷回部篇集](?!.*[。！？!?]$).{0,40}$/.test(line) ||
    /^[0-9０-９]{1,4}\s*[.．、)]$/.test(line) ||
    /^[0-9０-９]{1,4}$/.test(line)
  );
}

function isChapterHeading(line: string): boolean {
  return (
    /^第\s*[0-9０-９一二两三四五六七八九十百千万〇零]+\s*[章卷回部篇集](?!.*[。！？!?]$).{0,60}$/.test(line) ||
    /^(?:序章|楔子|引子|前言|正文|尾声|后记|番外(?:\s*[0-9０-９一二两三四五六七八九十]*)?)(?:\s|$|[:：·—-]).{0,60}$/.test(line) ||
    /^(?:chapter|part)\s+[0-9ivxlcdm]+\b.{0,60}$/i.test(line)
  );
}

function mergeShortUnits(paragraphs: string[]): string[] {
  const units: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const startsSection = isSectionHeading(paragraph.split("\n", 1)[0]?.trim() ?? "");
    if (startsSection && current) {
      units.push(current);
      current = paragraph;
      continue;
    }
    if (!current) {
      current = paragraph;
      continue;
    }

    const combined = `${current}\n\n${paragraph}`;
    if (combined.length <= LEGACY_TARGET_READING_UNIT_CHARS) {
      current = combined;
    } else {
      units.push(current);
      current = paragraph;
    }
  }

  if (current) units.push(current);
  return units;
}

function splitLongUnit(chunk: string): string[] {
  if (chunk.length <= LEGACY_MAX_READING_UNIT_CHARS) return [chunk];
  const paragraphs = chunk.split(/\n[ \t]*\n+/);
  const units: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if (paragraph.length > LEGACY_MAX_READING_UNIT_CHARS) {
      if (current) {
        units.push(current);
        current = "";
      }
      units.push(...splitLongLine(paragraph));
      continue;
    }
    const next = current ? `${current}\n\n${paragraph}` : paragraph;
    if (next.length > LEGACY_MAX_READING_UNIT_CHARS && current) {
      units.push(current);
      current = paragraph;
    } else {
      current = next;
    }
  }

  if (current) units.push(current);
  return units;
}

function splitLongLine(line: string): string[] {
  const chunks: string[] = [];
  for (let start = 0; start < line.length; start += LEGACY_MAX_READING_UNIT_CHARS) {
    chunks.push(line.slice(start, start + LEGACY_MAX_READING_UNIT_CHARS));
  }
  return chunks;
}

function splitOversizedChapter(chapter: string): string[] {
  if (chapter.length <= MAX_CHAPTER_CHARS) return [chapter];
  const paragraphs = chapter.split(/\n[ \t]*\n+/).map((item) => item.trim()).filter(Boolean);
  const parts: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if (paragraph.length > MAX_CHAPTER_CHARS) {
      if (current) {
        parts.push(current);
        current = "";
      }
      parts.push(...splitLongChapterParagraph(paragraph));
      continue;
    }
    const next = current ? `${current}\n\n${paragraph}` : paragraph;
    if (current && (next.length > MAX_CHAPTER_CHARS || current.length >= TARGET_CHAPTER_PART_CHARS)) {
      parts.push(current);
      current = paragraph;
    } else {
      current = next;
    }
  }
  if (current) parts.push(current);
  return parts;
}

function splitLongChapterParagraph(paragraph: string): string[] {
  const parts: string[] = [];
  let rest = paragraph;
  while (rest.length > MAX_CHAPTER_CHARS) {
    const window = rest.slice(0, MAX_CHAPTER_CHARS);
    const boundary = Math.max(
      window.lastIndexOf("。"),
      window.lastIndexOf("！"),
      window.lastIndexOf("？"),
      window.lastIndexOf("…")
    );
    const end = boundary >= TARGET_CHAPTER_PART_CHARS ? boundary + 1 : MAX_CHAPTER_CHARS;
    parts.push(rest.slice(0, end).trim());
    rest = rest.slice(end).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}
