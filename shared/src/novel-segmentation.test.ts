import { describe, expect, it } from "vitest";
import {
  buildNovelSegmentationIndexMap,
  novelReadingUnitLabel,
  splitNovelText,
  splitNovelTextForVersion
} from "./novel-segmentation.js";

describe("splitNovelText", () => {
  it("keeps a chapter-sized source together while preserving its paragraphs", () => {
    expect(splitNovelText(" 第一段。 \n\n\n## 第二段\n内容。 ")).toEqual([
      "第一段。\n\n## 第二段\n内容。"
    ]);
  });

  it("keeps legacy manifests on their original blank-line segmentation", () => {
    const sourceText = "第一段。\n\n第二段。";

    expect(splitNovelTextForVersion(sourceText, 2)).toEqual(["第一段。", "第二段。"]);
    expect(splitNovelTextForVersion(sourceText, 3)).toEqual(["第一段。\n\n第二段。"]);
    expect(splitNovelTextForVersion(sourceText, 4)).toEqual(["第一段。\n\n第二段。"]);
  });

  it("does not mistake platform-style numbered sections for chapters", () => {
    const chunks = splitNovelText(
      [
        "开头引子，这是一段原创测试文本。",
        "1.",
        "第一小节内容。",
        "2、",
        "第二小节内容。",
        "3",
        "第三小节内容。"
      ].join("\n")
    );

    expect(chunks).toEqual([
      [
        "开头引子，这是一段原创测试文本。",
        "1.",
        "第一小节内容。",
        "2、",
        "第二小节内容。",
        "3",
        "第三小节内容。"
      ].join("\n")
    ]);
  });

  it("splits on chapter headings but keeps sections inside their chapter", () => {
    const chunks = splitNovelText(
      [
        "序言。",
        "第一章 重逢",
        "章节内容。",
        "第 2 节",
        "小节内容。",
        "第3章",
        "结尾内容。"
      ].join("\n")
    );

    expect(chunks).toEqual([
      "序言。",
      "第一章 重逢\n章节内容。\n第 2 节\n小节内容。",
      "第3章\n结尾内容。"
    ]);
  });

  it("keeps normal long chapters whole and only splits beyond the safety limit", () => {
    expect(splitNovelText(`第一章\n${"长".repeat(9_000)}`)).toHaveLength(1);

    const chunks = splitNovelText(`第一章\n${"长。".repeat(7_000)}\n\n${"尾。".repeat(2_000)}`);

    expect(chunks.length).toBeGreaterThan(1);
    expect(Math.max(...chunks.map((chunk) => chunk.length))).toBeLessThanOrEqual(12_000);
    expect(chunks[0]).toContain("第一章");
  });

  it("keeps dialogue-heavy chapters intact without crossing chapter headings", () => {
    const dialogue = Array.from({ length: 12 }, (_, index) => `第${index + 1}句对白。${"内容".repeat(55)}`);
    const chunks = splitNovelText(
      ["第一章颜", ...dialogue, "第二章（完）", ...dialogue].join("\n\n")
    );

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toContain("第一章颜");
    expect(chunks[1]).toContain("第二章（完）");
    expect(novelReadingUnitLabel(chunks[0]!, 1)).toBe("第一章颜");
  });

  it("maps every old reading unit into its containing chapter", () => {
    const sourceText = [
      "第一章 重逢",
      ...Array.from({ length: 8 }, (_, index) => `${index}。${"甲".repeat(600)}`),
      "第二章 回家",
      ...Array.from({ length: 5 }, (_, index) => `${index}。${"乙".repeat(600)}`)
    ].join("\n\n");
    const result = buildNovelSegmentationIndexMap(sourceText, 3);

    expect(result.oldChunks.length).toBeGreaterThan(result.newChunks.length);
    expect(new Set(result.oldToNew)).toEqual(new Set([1, 2]));
    expect(result.oldToNew).toEqual([...result.oldToNew].sort((a, b) => a - b));
  });
});
