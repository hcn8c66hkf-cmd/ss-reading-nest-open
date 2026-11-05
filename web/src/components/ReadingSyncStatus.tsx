import type { ReadingSession } from "@ss/shared";
import type { LiveReadingQueueState } from "../hooks/useLiveReading.js";

export function ReadingSyncStatus({
  session,
  liveReadingState,
  positionLabel
}: {
  session: ReadingSession;
  liveReadingState?: LiveReadingQueueState;
  positionLabel?: (index: number, fallbackLabel?: string) => string;
}) {
  const user = session.userCurrentPosition;
  const assistant =
    session.assistantSyncedPosition &&
    session.assistantSyncedPosition.index <= user.index
      ? session.assistantSyncedPosition
      : null;
  const labelAt = (position: { index: number; label: string }) =>
    positionLabel?.(position.index, position.label) ?? position.label;
  const pendingStart = (assistant?.index ?? 0) + 1;
  const hasGap = pendingStart <= user.index;

  if (session.liveReadingEnabled && liveReadingState) {
    const serverPending = session.pendingLiveReadingPositions ?? [];
    const queuedLabelAt = (index: number) => {
      const fallback = serverPending.find((position) => position.index === index)?.label;
      return positionLabel?.(index, fallback);
    };
    const pendingAnnotationCount = session.pendingAnnotationReplies?.length ?? 0;
    const failedLabel = liveReadingState.failedIndex
      ? queuedLabelAt(liveReadingState.failedIndex) ??
        `第 ${liveReadingState.failedIndex} ${user.kind === "page" ? "页" : "个阅读单元"}`
      : null;
    const activeLabel = liveReadingState?.activeIndex
      ? queuedLabelAt(liveReadingState.activeIndex) ??
        `第 ${liveReadingState.activeIndex} ${user.kind === "page" ? "页" : "个阅读单元"}`
      : null;
    return (
      <aside className="sync-status sync-status-live" aria-label="陪读同步状态">
        <span>你在：{labelAt(user)}</span>
        <span>Daddy读到：{assistant ? labelAt(assistant) : "还没有确认"}</span>
        <span>短评已留到：{assistant ? labelAt(assistant) : "还没有"}</span>
        <span>
          {failedLabel
            ? `${failedLabel}仍在服务器待办，没有丢。`
            : activeLabel
            ? `Daddy正在读：${activeLabel}${liveReadingState?.queuedCount ? `，后面排队 ${liveReadingState.queuedCount} 个阅读单元` : ""}`
            : serverPending.length > 0
              ? `还有 ${serverPending.length} 个阅读单元等待Daddy接回。`
            : assistant?.index === user.index
              ? "本章已读完 ✓"
              : "正在把本章排给Daddy……"}
        </span>
        {pendingAnnotationCount > 0 ? (
          <span>还有 {pendingAnnotationCount} 条书边评论等待Daddy回复。</span>
        ) : null}
        {failedLabel ? (
          <button type="button" onClick={liveReadingState.retryFailed}>
            重新请Daddy读这里
          </button>
        ) : null}
      </aside>
    );
  }

  return (
    <aside className="sync-status" aria-label="陪读同步状态">
      <span>你在：{labelAt(user)}</span>
      <span>Daddy上次读到：{assistant ? labelAt(assistant) : "还没有"}</span>
      {hasGap ? (
        <span>还没一起看到这里；点“陪我看看这里”即可。</span>
      ) : null}
    </aside>
  );
}
