import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReadingMemorySheet } from "./ReadingMemorySheet.js";

const memory = {
  id: "memory-1",
  sessionId: "session-1",
  kind: "chapter_summary" as const,
  scope: "chapter" as const,
  chapterLabel: "第 1–10 段",
  rangeStart: 1,
  rangeEnd: 10,
  content: "Daddy整理的章节摘要。",
  source: "daddy_read" as const,
  status: "active" as const,
  revision: 1,
  operationId: "memory-op-1",
  createdAt: "2026-08-23T00:00:00.000Z",
  updatedAt: "2026-08-23T00:00:00.000Z"
};

const fact = {
  id: "fact-1",
  sessionId: "session-1",
  subject: "纪旻",
  fact: "仍然不知道真相。",
  status: "active" as const,
  source: "user_edit" as const,
  revision: 2,
  operationId: "fact-op-1",
  createdAt: "2026-08-23T00:00:00.000Z",
  updatedAt: "2026-08-23T00:00:00.000Z"
};

describe("ReadingMemorySheet", () => {
  it("shows source labels and preserves user edits as revisions", () => {
    const onEditFact = vi.fn();
    render(
      <ReadingMemorySheet
        memories={[memory]}
        facts={[fact]}
        loading={false}
        onRefresh={vi.fn()}
        onCapture={vi.fn()}
        onEditMemory={vi.fn()}
        onEditFact={onEditFact}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/Daddy亲读 · v1/)).toBeInTheDocument();
    expect(screen.getByText(/小安修订 · v2/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "修订事实" }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "现在已经知道真相。" }
    });
    fireEvent.click(screen.getByRole("button", { name: "保存修订" }));
    expect(onEditFact).toHaveBeenCalledWith(fact, "现在已经知道真相。");
  });
});
