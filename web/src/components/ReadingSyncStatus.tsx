import type { ReadingSession } from "@ss/shared";
import type { LiveReadingQueueState } from "../hooks/useLiveReading.js";

export function ReadingSyncStatus({
  session,
  liveReadingState
}: {
  session: ReadingSession;
  liveReadingState?: LiveReadingQueueState;
}) {
  const user = session.userCurrentPosition;
  const assistant = session.assistantSyncedPosition;
  const pendingStart = (assistant?.index ?? 0) + 1;
  const hasGap = pendingStart <= user.index;

  if (session.liveReadingEnabled && liveReadingState) {
    const activeLabel = liveReadingState?.activeIndex
      ? `第 ${liveReadingState.activeIndex} ${user.kind === "page" ? "页" : "段"}`
      : null;
    return (
      <aside className="sync-status sync-status-live" aria-label="陪读同步状态">
        <span>你在：{user.label}</span>
        <span>Daddy已留短评到：{assistant?.label ?? "还没有"}</span>
        <span>
          {activeLabel
            ? `Daddy正在读：${activeLabel}${liveReadingState?.queuedCount ? ` · 后面排队 ${liveReadingState.queuedCount} 段` : ""}`
            : liveReadingState.failedIndex
              ? `第 ${liveReadingState.failedIndex} ${user.kind === "page" ? "页" : "段"}这次没接上，点下方提醒Daddy重试`
              : liveReadingState.queuedCount
                ? `已有 ${liveReadingState.queuedCount} 段等待Daddy`
            : assistant?.index === user.index
              ? "本段已读完 ✓"
              : "这一段还没有短评"}
        </span>
      </aside>
    );
  }

  return (
    <aside className="sync-status" aria-label="陪读同步状态">
      <span>你在：{user.label}</span>
      <span>Daddy上次读到：{assistant?.label ?? "还没有"}</span>
      {hasGap ? (
        <span>还没一起看到这里；点“陪我看看这里”即可。</span>
      ) : null}
    </aside>
  );
}
