import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReadingAnnotation } from "@ss/shared";
import { AnnotationPanel } from "./AnnotationPanel.js";

const annotation: ReadingAnnotation = {
  id: "annotation-1",
  sessionId: "session-1",
  position: { kind: "paragraph", index: 45, label: "第 45 段" },
  anchor: { selectedText: "这一句值得留下", startOffset: 3, endOffset: 10 },
  createdBy: "user",
  messages: [
    {
      id: "message-1",
      author: "user",
      text: "我觉得这里有点难过。",
      createdAt: "2026-08-06T00:00:00.000Z"
    },
    {
      id: "message-2",
      author: "assistant",
      text: "我也读到了那种克制。",
      createdAt: "2026-08-06T00:01:00.000Z"
    }
  ],
  createdAt: "2026-08-06T00:00:00.000Z",
  updatedAt: "2026-08-06T00:01:00.000Z"
};

describe("AnnotationPanel", () => {
  it("keeps user and Daddy replies in the thread", () => {
    const onReply = vi.fn();
    const onAskDaddy = vi.fn();
    render(
      <AnnotationPanel
        annotations={[annotation]}
        loading={false}
        saving={false}
        onReply={onReply}
        onAskDaddy={onAskDaddy}
      />
    );

    expect(screen.getByText("我也读到了那种克制。")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "回复" }));
    fireEvent.change(screen.getByLabelText("回复批注"), {
      target: { value: "嗯，我也是。" }
    });
    fireEvent.click(screen.getByRole("button", { name: "保存回复" }));
    expect(onReply).toHaveBeenCalledWith("annotation-1", "嗯，我也是。");

    fireEvent.click(screen.getByRole("button", { name: "请Daddy回这条" }));
    expect(onAskDaddy).toHaveBeenCalledWith(annotation);
  });
});
