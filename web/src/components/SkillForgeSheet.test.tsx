import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SkillForgeSheet } from "./SkillForgeSheet.js";

const candidate = {
  id: "candidate-1",
  sessionId: "session-1",
  scope: "chapter" as const,
  chapterLabel: "第 1–20 段",
  rangeStart: 1,
  rangeEnd: 20,
  totalUnits: 80,
  verdict: "forge_skill" as const,
  title: "递进复盘提问",
  rationale: "这是一套可以重复执行的流程。",
  skillName: "reflection-prompts",
  description: "Use when the user asks for reflection prompts.",
  triggerExamples: ["帮我复盘这一章"],
  workflow: ["识别转折", "生成问题"],
  boundaries: ["不补写未读内容"],
  sourceNotes: ["覆盖第 1–20 段"],
  skillMarkdown: "---\nname: reflection-prompts\n---",
  analysisFingerprint: "snapshot-v1-deadbeef",
  generatorVersion: "p3-v1" as const,
  status: "draft" as const,
  operationId: "skill-candidate-v33:test",
  createdAt: "2026-08-23T00:00:00.000Z",
  updatedAt: "2026-08-23T00:00:00.000Z"
};

describe("SkillForgeSheet", () => {
  it("shows the verdict and lets the user copy a forgeable candidate", () => {
    const onCopy = vi.fn();
    render(
      <SkillForgeSheet
        candidates={[candidate]}
        loading={false}
        onForge={vi.fn()}
        onCopy={onCopy}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("值得炼成 Skill")).toBeInTheDocument();
    expect(screen.getByText("第 1–20 段")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "复制候选包" }));
    expect(onCopy).toHaveBeenCalledWith(candidate);
  });

  it("does not offer a package when the verdict is knowledge-only", () => {
    render(
      <SkillForgeSheet
        candidates={[{ ...candidate, verdict: "knowledge_only", skillMarkdown: undefined }]}
        loading={false}
        onForge={vi.fn()}
        onCopy={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("更适合知识卡")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "复制候选包" })).toBeNull();
  });
});
