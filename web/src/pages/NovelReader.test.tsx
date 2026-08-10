import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SESSION_PREFERENCES } from "@ss/shared";
import { NovelReader } from "./NovelReader.js";

describe("NovelReader display layout", () => {
  it("restores the reading scroll position after fullscreen or orientation changes", () => {
    const props = {
      session: {
        id: "novel-scroll",
        title: "小说",
        type: "novel" as const,
        status: "active" as const,
        userCurrentPosition: { kind: "paragraph" as const, index: 1, total: 1, label: "第 1 段" },
        assistantSyncedPosition: null,
        liveReadingEnabled: false,
        sessionPreferences: DEFAULT_SESSION_PREFERENCES,
        sourceManifest: null,
        createdAt: "2026-06-22T00:00:00.000Z",
        updatedAt: "2026-06-22T00:00:00.000Z",
        lastReadAt: "2026-06-22T00:00:00.000Z"
      },
      chunks: ["第一段。"],
      onPosition: vi.fn(),
      onLook: vi.fn(),
      onSaveQuote: vi.fn(),
      onFinish: vi.fn(),
      onBack: vi.fn(),
      onFullscreen: vi.fn(),
      onSettings: vi.fn(),
      onMore: vi.fn(),
      companionComments: [],
      companionLoading: false,
      companionLayout: "wide" as const,
      syncRequestInFlight: false,
      canRequestPip: false,
      onRequestPip: vi.fn(),
      onClearCompanionComments: vi.fn(),
      initialScrollTop: 96,
      onScrollPosition: vi.fn()
    };
    const { container, rerender } = render(
      <NovelReader {...props} companionLayoutRevision={0} />
    );
    const scroll = container.querySelector<HTMLElement>(".reader-scroll")!;
    expect(scroll.scrollTop).toBe(96);
    scroll.scrollTop = 0;

    rerender(<NovelReader {...props} companionLayout="compact" companionLayoutRevision={1} />);
    expect(scroll.scrollTop).toBe(96);
  });

  it("renders persisted book-edge annotations over their exact text", () => {
    const onCreateAnnotation = vi.fn();
    render(
      <NovelReader
        session={{
          id: "novel-annotation",
          title: "小说",
          type: "novel",
          status: "active",
          userCurrentPosition: { kind: "paragraph", index: 1, total: 1, label: "第 1 段" },
          assistantSyncedPosition: null,
          liveReadingEnabled: false,
          sessionPreferences: DEFAULT_SESSION_PREFERENCES,
          sourceManifest: null,
          createdAt: "2026-08-06T00:00:00.000Z",
          updatedAt: "2026-08-06T00:00:00.000Z",
          lastReadAt: "2026-08-06T00:00:00.000Z"
        }}
        chunks={["她停了一下，她又停了一下"]}
        annotations={[{
          id: "annotation-1",
          sessionId: "novel-annotation",
          position: { kind: "paragraph", index: 1, label: "第 1 段" },
          anchor: { selectedText: "停了一下", startOffset: 1, endOffset: 5 },
          createdBy: "assistant",
          messages: [],
          createdAt: "2026-08-06T00:00:00.000Z",
          updatedAt: "2026-08-06T00:00:00.000Z"
        }]}
        onPosition={vi.fn()}
        onLook={vi.fn()}
        onSaveQuote={vi.fn()}
        onCreateAnnotation={onCreateAnnotation}
        onFinish={vi.fn()}
        onBack={vi.fn()}
        onFullscreen={vi.fn()}
        onSettings={vi.fn()}
        onMore={vi.fn()}
        companionComments={[]}
        companionLoading={false}
        companionLayout="wide"
        companionLayoutRevision={0}
        syncRequestInFlight={false}
        canRequestPip={false}
        onRequestPip={vi.fn()}
        onClearCompanionComments={vi.fn()}
        initialScrollTop={0}
        onScrollPosition={vi.fn()}
      />
    );

    expect(screen.getByText("停了一下")).toHaveClass(
      "reading-annotation-assistant"
    );
    expect(screen.getByText("Daddy划了线")).toBeInTheDocument();

    const trailingText = document.querySelector(".novel-paper p")?.lastChild;
    expect(trailingText?.textContent).toBe("，她又停了一下");
    const range = document.createRange();
    range.setStart(trailingText!, 3);
    range.setEnd(trailingText!, 7);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    fireEvent(document, new Event("selectionchange"));
    fireEvent.click(screen.getByRole("button", { name: "划线" }));
    expect(onCreateAnnotation).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedText: "停了一下",
        startOffset: 8,
        endOffset: 12
      }),
      undefined
    );
  });
});
