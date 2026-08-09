import { useEffect, useRef, useState, type ReactNode } from "react";
import type {
  CompanionComment,
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
  annotationsLoading?: boolean;
  annotationsError?: string;
  annotationSaving?: boolean;
  onCreateAnnotation?: (anchor: TextAnchor, comment?: string) => void;
  onReplyAnnotation?: (annotationId: string, text: string) => void;
  onAskDaddyReply?: (annotation: ReadingAnnotation) => void;
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
  const [selectedAnchor, setSelectedAnchor] = useState<TextAnchor | null>(null);
  const selected = selectedAnchor?.selectedText ?? "";
  const previous = () => props.onPosition(Math.max(1, index));
  const next = () => props.onPosition(Math.min(props.chunks.length, index + 2));
  const swipe = useHorizontalPaging(previous, next);
  const scrollRef = useRef<HTMLElement>(null);
  const paperRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = props.initialScrollTop;
  }, [index, props.companionLayoutRevision]);

  useEffect(() => setSelectedAnchor(null), [index]);

  useEffect(() => {
    const onSelectionChange = () => {
      const anchor = readSelectionAnchor(current, paperRef.current);
      if (anchor) setSelectedAnchor(anchor);
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, [current]);

  const captureSelection = () => {
    setSelectedAnchor(readSelectionAnchor(current, paperRef.current));
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
      <ReadingSyncStatus session={props.session} />
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
            selectedAnchor={selectedAnchor}
            annotations={props.annotations ?? []}
            loading={props.annotationsLoading ?? false}
            error={props.annotationsError}
            saving={props.annotationSaving ?? false}
            onCreate={(anchor, comment) => {
              props.onCreateAnnotation?.(anchor, comment);
              setSelectedAnchor(null);
              window.getSelection()?.removeAllRanges();
            }}
            onReply={(annotationId, text) =>
              props.onReplyAnnotation?.(annotationId, text)
            }
            onAskDaddy={(annotation) => props.onAskDaddyReply?.(annotation)}
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
      <ReaderActions
        primaryLabel="陪我看看这里"
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

function readSelectionAnchor(
  text: string,
  paper: HTMLElement | null
): TextAnchor | null {
  const selection = window.getSelection();
  const selectedText = selection?.toString().trim() ?? "";
  if (!selection || !selectedText || !paper) return null;
  if (selection.rangeCount === 0 || typeof selection.getRangeAt !== "function") {
    return createTextAnchor(text, selectedText);
  }
  const range = selection.getRangeAt(0);
  if (!paper.contains(range.startContainer) || !paper.contains(range.endContainer)) {
    return null;
  }
  const start = selectionPointOffset(range.startContainer, range.startOffset, paper);
  const end = selectionPointOffset(range.endContainer, range.endOffset, paper);
  if (start === null || end === null || end <= start) {
    return createTextAnchor(text, selectedText);
  }
  const exactText = text.slice(start, end);
  return {
    selectedText: exactText || selectedText,
    startOffset: start,
    endOffset: end,
    prefix: text.slice(Math.max(0, start - 60), start),
    suffix: text.slice(end, end + 60)
  };
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
