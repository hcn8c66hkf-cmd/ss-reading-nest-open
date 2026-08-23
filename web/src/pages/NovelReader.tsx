import { useEffect, useRef, useState, type ReactNode } from "react";
import type {
  CompanionComment,
  AnnotationFavorite,
  ReadingAnnotation,
  ReadingSession,
  TextAnchor
} from "@ss/shared";
import { useHorizontalPaging } from "../hooks/useHorizontalPaging.js";
import type { CompanionLayout } from "../hooks/useReadingHostLayout.js";
import {
  CompanionDock,
  type PendingCompanionCommentDraft
} from "../components/CompanionDock.js";
import { ReaderHeader } from "../components/ReaderHeader.js";
import { ReaderActions } from "../components/ReaderActions.js";
import { ReadingSyncStatus } from "../components/ReadingSyncStatus.js";
import { AnnotationPanel } from "../components/AnnotationPanel.js";
import type { LiveReadingQueueState } from "../hooks/useLiveReading.js";

export function NovelReader(props: {
  session: ReadingSession;
  chunks: string[];
  onPosition: (index: number) => void;
  onLook: (
    currentText: string,
    selectedText: string,
    selectedAnchor?: TextAnchor
  ) => void;
  onSaveQuote: (content: string) => void;
  annotations?: ReadingAnnotation[];
  annotationFavorites?: AnnotationFavorite[];
  annotationsLoading?: boolean;
  annotationsError?: string;
  annotationSaving?: boolean;
  pendingDaddyAnnotationIds?: ReadonlySet<string>;
  liveReadingState?: LiveReadingQueueState;
  onCreateAnnotation?: (anchor: TextAnchor, comment?: string) => Promise<boolean> | boolean;
  onReplyAnnotation?: (annotationId: string, text: string) => void;
  onToggleAnnotationFavorite?: (
    annotationId: string,
    messageId: string | undefined,
    favorite: boolean
  ) => void;
  onFinish: () => void;
  onBack: () => void;
  onFullscreen: () => void;
  fullscreenLabel?: string;
  themeMode?: "light" | "dark";
  immersive?: boolean;
  onToggleTheme?: () => void;
  onSettings: () => void;
  onMore: () => void;
  companionComments: CompanionComment[];
  companionLoading: boolean;
  companionError?: string;
  companionLayout: CompanionLayout;
  companionLayoutRevision: number;
  syncRequestInFlight: boolean;
  canRequestPip: boolean;
  onRequestPip: () => void;
  pendingCommentDraft?: PendingCompanionCommentDraft | null;
  pendingCommentSaving?: boolean;
  onSavePendingComment?: (text: string) => void;
  onClearCompanionComments: () => void;
  initialScrollTop: number;
  onScrollPosition: (scrollTop: number) => void;
}) {
  const index = Math.max(
    0,
    Math.min(props.chunks.length - 1, props.session.userCurrentPosition.index - 1)
  );
  const current = props.chunks[index] ?? "";
  const [selection, setSelection] = useState<SelectionSnapshot | null>(null);
  const [commentOpen, setCommentOpen] = useState(false);
  const [comment, setComment] = useState("");
  const selectedAnchor = selection?.anchor ?? null;
  const selected = selectedAnchor?.selectedText ?? "";
  const previous = () => props.onPosition(Math.max(1, index));
  const next = () => props.onPosition(Math.min(props.chunks.length, index + 2));
  const swipe = useHorizontalPaging(previous, next);
  const scrollRef = useRef<HTMLElement>(null);
  const paperRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = props.initialScrollTop;
  }, [index, props.companionLayoutRevision]);

  useEffect(() => {
    setSelection(null);
    setCommentOpen(false);
    setComment("");
  }, [index]);

  useEffect(() => {
    const onSelectionChange = () => {
      const nextSelection = readSelection(current, paperRef.current);
      if (nextSelection) setSelection(nextSelection);
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, [current]);

  const captureSelection = () => {
    const nextSelection = readSelection(current, paperRef.current);
    if (nextSelection) setSelection(nextSelection);
  };

  const clearSelection = () => {
    setSelection(null);
    setCommentOpen(false);
    setComment("");
    window.getSelection()?.removeAllRanges();
  };

  const saveSelection = async (selectedComment?: string) => {
    if (!selectedAnchor || !props.onCreateAnnotation) return;
    const saved = await props.onCreateAnnotation(selectedAnchor, selectedComment);
    if (saved) clearSelection();
  };

  return (
    <main
      className={`reader-shell reader-with-dock companion-layout-${props.companionLayout}${
        props.immersive ? " reader-immersive" : ""
      }`}
    >
      <ReaderHeader
        title={props.session.title}
        progress={`第 ${index + 1} 段 / 共 ${props.chunks.length} 段`}
        fullscreenLabel={props.fullscreenLabel}
        themeMode={props.themeMode}
        onBack={props.onBack}
        onFullscreen={props.onFullscreen}
        onToggleTheme={props.onToggleTheme}
        onSettings={props.onSettings}
        onMore={props.onMore}
      />
      <ReadingSyncStatus
        session={props.session}
        liveReadingState={props.liveReadingState}
      />
      <div className="reader-workspace">
        <section
          ref={scrollRef}
          className="reader-scroll novel-scroll"
          {...swipe}
          onScroll={(event) => props.onScrollPosition(event.currentTarget.scrollTop)}
          onMouseUp={captureSelection}
          onTouchEnd={(event) => {
            swipe.onTouchEnd(event);
            captureSelection();
          }}
        >
          <article ref={paperRef} className="novel-paper">
            {current.split("\n").map((line, lineIndex) => (
              <p key={lineIndex} data-line-start={lineStartOffset(current, lineIndex)}>
                {renderAnnotatedLine(
                  line,
                  lineIndex,
                  current,
                  props.annotations ?? []
                )}
              </p>
            ))}
          </article>
          <AnnotationPanel
            annotations={props.annotations ?? []}
            loading={props.annotationsLoading ?? false}
            error={props.annotationsError}
            saving={props.annotationSaving ?? false}
            pendingDaddyIds={props.pendingDaddyAnnotationIds}
            favorites={props.annotationFavorites}
            onReply={(annotationId, text) =>
              props.onReplyAnnotation?.(annotationId, text)
            }
            onToggleFavorite={props.onToggleAnnotationFavorite}
          />
          <div className="page-buttons">
            <button onClick={previous} disabled={index === 0}>上一段</button>
            <span>{index + 1} / {props.chunks.length}</span>
            <button onClick={next} disabled={index >= props.chunks.length - 1}>下一段</button>
          </div>
        </section>
        <CompanionDock
          sessionId={props.session.id}
          comments={props.companionComments}
          layout={props.companionLayout}
          layoutRevision={props.companionLayoutRevision}
          loading={props.companionLoading}
          error={props.companionError}
          canRequestPip={props.canRequestPip}
          onRequestPip={props.onRequestPip}
          pendingCommentDraft={props.pendingCommentDraft}
          pendingCommentSaving={props.pendingCommentSaving}
          onSavePendingComment={props.onSavePendingComment}
          onJump={props.onPosition}
          onClear={props.onClearCompanionComments}
        />
      </div>
      {selection && !commentOpen ? (
        <div
          className={`selection-annotation-toolbar ${selection.placement}`}
          style={{ left: selection.left, top: selection.top }}
          role="toolbar"
          aria-label="选中文字的操作"
        >
          <button
            type="button"
            disabled={props.annotationSaving}
            onClick={() => void saveSelection()}
          >
            {props.annotationSaving ? "保存中…" : "划线"}
          </button>
          <button
            type="button"
            disabled={props.annotationSaving}
            onClick={() => setCommentOpen(true)}
          >
            写评论
          </button>
        </div>
      ) : null}
      {selection && commentOpen ? (
        <div className="selection-comment-backdrop" role="presentation">
          <form
            className="selection-comment-sheet"
            aria-label="给选中文字写评论"
            onSubmit={(event) => {
              event.preventDefault();
              const text = comment.trim();
              if (!text || props.annotationSaving) return;
              void saveSelection(text);
            }}
          >
            <div className="selection-comment-handle" aria-hidden="true" />
            <strong>写在这句话旁边</strong>
            <blockquote>“{selectedAnchor?.selectedText}”</blockquote>
            <textarea
              autoFocus
              aria-label="批注内容"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="我读到这里想到……"
            />
            <div className="selection-comment-actions">
              <button type="button" onClick={() => setCommentOpen(false)}>
                返回
              </button>
              <button
                type="submit"
                className="annotation-primary"
                disabled={!comment.trim() || props.annotationSaving}
              >
                {props.annotationSaving ? "保存中…" : "划线并评论"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
      <ReaderActions
        primaryLabel={props.session.liveReadingEnabled ? "提醒Daddy看本段" : "陪我看看这里"}
        secondaryLabel="保存这句"
        onPrimary={() => props.onLook(current, selected, selectedAnchor ?? undefined)}
        primaryDisabled={props.syncRequestInFlight}
        onSecondary={() => props.onSaveQuote(selected)}
        secondaryDisabled={!selected}
        onFinish={props.onFinish}
      />
    </main>
  );
}

type SelectionSnapshot = {
  anchor: TextAnchor;
  left: number;
  top: number;
  placement: "above" | "below" | "fallback";
};

function readSelection(
  text: string,
  paper: HTMLElement | null
): SelectionSnapshot | null {
  const selection = window.getSelection();
  const selectedText = selection?.toString().trim() ?? "";
  if (!selection || !selectedText || !paper) return null;
  if (selection.rangeCount === 0 || typeof selection.getRangeAt !== "function") {
    return withSelectionPosition(createTextAnchor(text, selectedText), null);
  }
  const range = selection.getRangeAt(0);
  if (!paper.contains(range.startContainer) || !paper.contains(range.endContainer)) {
    return null;
  }
  const rect = typeof range.getBoundingClientRect === "function"
    ? range.getBoundingClientRect()
    : null;
  const start = selectionPointOffset(range.startContainer, range.startOffset, paper);
  const end = selectionPointOffset(range.endContainer, range.endOffset, paper);
  if (start === null || end === null || end <= start) {
    return withSelectionPosition(createTextAnchor(text, selectedText), rect);
  }
  const exactText = text.slice(start, end);
  return withSelectionPosition({
    selectedText: exactText || selectedText,
    startOffset: start,
    endOffset: end,
    prefix: text.slice(Math.max(0, start - 60), start),
    suffix: text.slice(end, end + 60)
  }, rect);
}

function withSelectionPosition(
  anchor: TextAnchor,
  rect: Pick<DOMRect, "left" | "top" | "bottom" | "width"> | null
): SelectionSnapshot {
  if (!rect || (!rect.width && !rect.top && !rect.bottom)) {
    return { anchor, left: window.innerWidth / 2, top: window.innerHeight - 112, placement: "fallback" };
  }
  const left = Math.min(Math.max(rect.left + rect.width / 2, 86), window.innerWidth - 86);
  if (rect.bottom <= window.innerHeight - 72) {
    return { anchor, left, top: rect.bottom + 10, placement: "below" };
  }
  return { anchor, left, top: rect.top - 10, placement: "above" };
}

function selectionPointOffset(
  node: Node,
  nodeOffset: number,
  paper: HTMLElement
): number | null {
  const element = node.nodeType === Node.ELEMENT_NODE
    ? (node as Element)
    : node.parentElement;
  const line = element?.closest<HTMLElement>("p[data-line-start]");
  if (!line || !paper.contains(line)) return null;
  const lineStart = Number(line.dataset.lineStart);
  if (!Number.isFinite(lineStart)) return null;
  const before = document.createRange();
  before.selectNodeContents(line);
  before.setEnd(node, nodeOffset);
  return lineStart + before.toString().length;
}

function lineStartOffset(text: string, lineIndex: number) {
  return text
    .split("\n")
    .slice(0, lineIndex)
    .reduce((total, line) => total + line.length + 1, 0);
}

function createTextAnchor(text: string, selectedText: string): TextAnchor {
  const startOffset = text.indexOf(selectedText);
  if (startOffset < 0) return { selectedText };
  const endOffset = startOffset + selectedText.length;
  return {
    selectedText,
    startOffset,
    endOffset,
    prefix: text.slice(Math.max(0, startOffset - 60), startOffset),
    suffix: text.slice(endOffset, endOffset + 60)
  };
}

function renderAnnotatedLine(
  line: string,
  lineIndex: number,
  fullText: string,
  annotations: ReadingAnnotation[]
) {
  const lineStart = lineStartOffset(fullText, lineIndex);
  const ranges = annotations
    .map((annotation) => {
      const start =
        annotation.anchor.startOffset ?? fullText.indexOf(annotation.anchor.selectedText);
      const end = annotation.anchor.endOffset ?? start + annotation.anchor.selectedText.length;
      return {
        id: annotation.id,
        start: Math.max(0, start - lineStart),
        end: Math.min(line.length, end - lineStart),
        author: annotation.createdBy
      };
    })
    .filter((range) => range.start < range.end)
    .sort((left, right) => left.start - right.start);
  if (ranges.length === 0) return line;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start < cursor) continue;
    if (range.start > cursor) nodes.push(line.slice(cursor, range.start));
    nodes.push(
      <mark
        key={range.id}
        className={`reading-annotation reading-annotation-${range.author}`}
      >
        {line.slice(range.start, range.end)}
      </mark>
    );
    cursor = range.end;
  }
  if (cursor < line.length) nodes.push(line.slice(cursor));
  return nodes;
}
