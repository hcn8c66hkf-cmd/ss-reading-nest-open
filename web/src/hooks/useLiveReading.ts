import { useCallback, useEffect, useRef, useState } from "react";

export interface LiveReadingQueueState {
  activeIndex: number | null;
  queuedCount: number;
  failedIndex: number | null;
  retryFailed: () => void;
}

type LiveReadingQueueSnapshot = Omit<LiveReadingQueueState, "retryFailed">;

export function useLiveReading(input: {
  enabled: boolean;
  sessionKey?: string;
  userPositionIndex: number;
  assistantPositionIndex: number;
  sourceVerified: boolean;
  retryMs?: number;
  onQueuedPosition: (index: number) => Promise<boolean | void> | boolean | void;
}): LiveReadingQueueState {
  const queue = useRef<number[]>([]);
  const queuedKeys = useRef(new Set<string>());
  const activeIndex = useRef<number | null>(null);
  const failedIndex = useRef<number | null>(null);
  const lastObservedIndex = useRef<number | null>(null);
  const assistantPositionIndex = useRef(input.assistantPositionIndex);
  const enabled = useRef(input.enabled);
  const sourceVerified = useRef(input.sourceVerified);
  const onQueuedPosition = useRef(input.onQueuedPosition);
  const timeout = useRef<number | null>(null);
  const retryCounts = useRef(new Map<number, number>());
  const [state, setState] = useState<LiveReadingQueueSnapshot>({
    activeIndex: null,
    queuedCount: 0,
    failedIndex: null
  });
  const pump = useRef<() => void>(() => undefined);

  const publishState = () => {
    setState({
      activeIndex: activeIndex.current,
      queuedCount: queue.current.length,
      failedIndex: failedIndex.current
    });
  };

  const clearTimeoutRef = () => {
    if (timeout.current !== null) window.clearTimeout(timeout.current);
    timeout.current = null;
  };

  pump.current = () => {
    if (
      !enabled.current ||
      !sourceVerified.current ||
      activeIndex.current !== null ||
      failedIndex.current !== null
    ) return;
    const next = queue.current.shift();
    if (next === undefined) {
      publishState();
      return;
    }
    if (assistantPositionIndex.current >= next) {
      retryCounts.current.delete(next);
      publishState();
      queueMicrotask(() => pump.current());
      return;
    }
    activeIndex.current = next;
    publishState();
    void Promise.resolve(onQueuedPosition.current(next)).then((sent) => {
      if (activeIndex.current !== next) return;
      if (sent === false) {
        activeIndex.current = null;
        const retries = retryCounts.current.get(next) ?? 0;
        if (retries < 1) {
          retryCounts.current.set(next, retries + 1);
          queue.current.unshift(next);
        } else {
          failedIndex.current = next;
        }
        publishState();
        if (failedIndex.current === null) {
          timeout.current = window.setTimeout(() => pump.current(), 1_500);
        }
        return;
      }
      clearTimeoutRef();
      timeout.current = window.setTimeout(() => {
        if (activeIndex.current !== next) return;
        const retries = retryCounts.current.get(next) ?? 0;
        activeIndex.current = null;
        if (retries < 1) {
          retryCounts.current.set(next, retries + 1);
          queue.current.unshift(next);
        } else {
          failedIndex.current = next;
        }
        publishState();
        pump.current();
      }, input.retryMs ?? 30_000);
    });
  };

  useEffect(() => {
    onQueuedPosition.current = input.onQueuedPosition;
  }, [input.onQueuedPosition]);

  useEffect(() => {
    enabled.current = input.enabled;
    sourceVerified.current = input.sourceVerified;
    assistantPositionIndex.current = input.assistantPositionIndex;
  }, [input.enabled, input.sourceVerified, input.assistantPositionIndex]);

  useEffect(() => {
    clearTimeoutRef();
    queue.current = [];
    queuedKeys.current.clear();
    activeIndex.current = null;
    failedIndex.current = null;
    lastObservedIndex.current = null;
    retryCounts.current.clear();
    publishState();
  }, [input.enabled, input.sessionKey]);

  useEffect(() => {
    if (!input.enabled || !input.sourceVerified || !input.sessionKey) return;
    const previous = lastObservedIndex.current;
    const indices = previous === null
      ? [input.userPositionIndex]
      : input.userPositionIndex > previous
        ? Array.from(
            { length: input.userPositionIndex - previous },
            (_, offset) => previous + offset + 1
          )
        : [input.userPositionIndex];
    lastObservedIndex.current = input.userPositionIndex;
    for (const index of indices) {
      if (index <= input.assistantPositionIndex) continue;
      const key = `${input.sessionKey}:${index}`;
      if (queuedKeys.current.has(key) || activeIndex.current === index) continue;
      queuedKeys.current.add(key);
      queue.current.push(index);
    }
    publishState();
    pump.current();
  }, [
    input.assistantPositionIndex,
    input.enabled,
    input.sessionKey,
    input.sourceVerified,
    input.userPositionIndex
  ]);

  useEffect(() => {
    assistantPositionIndex.current = input.assistantPositionIndex;
    if (
      failedIndex.current !== null &&
      input.assistantPositionIndex >= failedIndex.current
    ) {
      retryCounts.current.delete(failedIndex.current);
      failedIndex.current = null;
      publishState();
      pump.current();
    }
    const active = activeIndex.current;
    if (active === null || input.assistantPositionIndex < active) return;
    clearTimeoutRef();
    retryCounts.current.delete(active);
    activeIndex.current = null;
    publishState();
    pump.current();
  }, [input.assistantPositionIndex]);

  useEffect(() => () => clearTimeoutRef(), []);

  const retryFailed = useCallback(() => {
    const failed = failedIndex.current;
    if (failed === null) return;
    retryCounts.current.delete(failed);
    failedIndex.current = null;
    queue.current.unshift(failed);
    publishState();
    pump.current();
  }, []);

  return { ...state, retryFailed };
}
