import type { ReadingSyncJob, SyncBatch } from "./types.js";
import type { CommentLength, ReadingCommentMode, TextAnchor } from "@ss/shared";
import { buildReadingCommentPrompt } from "../reading-comments/prompt-policy.js";

export function buildBatchChatMessage(job: ReadingSyncJob, batch: SyncBatch) {
  return [
    batchHeader(batch),
    "",
    "这是 skipped range 分批补课，不是正式点评。",
    `用户当前已读到${job.targetPosition.label}，Daddy上次确认读到${confirmedLabel(job)}。`,
    "这是补课批次。Daddy先安静追到用户当前位置，不展开评论。",
    `只简短回复：“已读到第 ${batch.rangeEnd} 段。”`,
    "",
    batch.text
  ].join("\n");
}

export function buildBatchUserNote(job: ReadingSyncJob, batch: SyncBatch) {
  return [
    "syncType=skipped-range-batch",
    `sessionId=${job.sessionId}`,
    `userCurrentPosition=${job.targetPosition.index}`,
    `assistantSyncedPosition=${job.confirmedThrough?.index ?? "null"}`,
    `batchId=${batch.id}`,
    `batchRange=${batch.rangeStart}-${batch.rangeEnd}`,
    `batchOrdinal=${batch.ordinal}/${batch.totalBatches}`,
    `hasMoreBatches=${!batch.isFinal}`
  ].join("; ");
}

export function buildFormalReadingPrompt(
  job: ReadingSyncJob,
  preferences: {
    mode: ReadingCommentMode;
    length: CommentLength;
    operationId: string;
    autoSaveCompanionComments: boolean;
  }
) {
  const start = job.batches[0]?.rangeStart ?? job.targetPosition.index;
  return buildReadingCommentPrompt({
    sessionId: job.sessionId,
    mode: preferences.mode,
    length: preferences.length,
    title: job.title,
    position: job.targetPosition,
    syncedRange: { start, end: job.targetPosition.index },
    source: "catch_up_complete",
    operationId: preferences.operationId,
    autoSaveCompanionComments: preferences.autoSaveCompanionComments
  });
}

export function buildCurrentOnlyPrompt(input: {
  sessionId: string;
  title: string;
  position: number;
  text: string;
  selectedText?: string;
  selectedAnchor?: TextAnchor;
  hasUnconfirmedGap: boolean;
  mode: ReadingCommentMode;
  length: CommentLength;
  operationId: string;
  autoSaveCompanionComments: boolean;
}) {
  return [
    `【只看当前段：第 ${input.position} 段】`,
    `《${input.title}》`,
    input.hasUnconfirmedGap
      ? "中间存在未同步剧情，请不要假装知道未提供的内容。"
      : "请只分析当前段。",
    input.text,
    input.selectedText
      ? [
          `用户明确选中的原文：${input.selectedText}`,
          "请把对这句原文的最终回应写成书边批注：先调用 create_annotation，再在聊天区回复相同内容。",
          `create_annotation 固定参数：${JSON.stringify({
            sessionId: input.sessionId,
            position: {
              kind: "paragraph",
              index: input.position,
              label: `第 ${input.position} 段`
            },
            anchor: input.selectedAnchor ?? { selectedText: input.selectedText },
            author: "assistant",
            operationId: `assistant-annotation-${input.operationId}`
          })}；另加 comment=你的最终回应全文。`
        ].join("\n")
      : "",
    "",
    buildReadingCommentPrompt({
      sessionId: input.sessionId,
      mode: input.mode,
      length: input.length,
      title: input.title,
      position: {
        kind: "paragraph",
        index: input.position,
        label: `第 ${input.position} 段`
      },
      source: "current_only",
      operationId: input.operationId,
      autoSaveCompanionComments: input.autoSaveCompanionComments
    })
  ].join("\n");
}

export function buildRecentOnlyPrompt(input: {
  sessionId: string;
  title: string;
  rangeStart: number;
  rangeEnd: number;
  text: string;
  mode: ReadingCommentMode;
  length: CommentLength;
  operationId: string;
  autoSaveCompanionComments: boolean;
}) {
  return [
    `【补最近几段：第 ${input.rangeStart}–${input.rangeEnd} 段】`,
    `《${input.title}》`,
    "这是局部陪读，不代表中间未提供的剧情已经同步。",
    input.text,
    "",
    buildReadingCommentPrompt({
      sessionId: input.sessionId,
      mode: input.mode,
      length: input.length,
      title: input.title,
      position: {
        kind: "paragraph",
        index: input.rangeEnd,
        label: `第 ${input.rangeEnd} 段`
      },
      syncedRange: { start: input.rangeStart, end: input.rangeEnd },
      source: "quick_action",
      operationId: input.operationId,
      autoSaveCompanionComments: input.autoSaveCompanionComments
    })
  ].join("\n");
}

function batchHeader(batch: SyncBatch) {
  return `【补课第 ${batch.ordinal}/${batch.totalBatches} 批：第 ${batch.rangeStart}–${batch.rangeEnd} 段】`;
}

function confirmedLabel(job: ReadingSyncJob) {
  return job.confirmedThrough?.label ?? "尚未同步";
}
