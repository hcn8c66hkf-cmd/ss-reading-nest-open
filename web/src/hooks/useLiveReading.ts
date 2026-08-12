import { useEffect, useRef, useState } from "react";

export interface LiveReadingQueueState {
  activeIndex: number | null;
  queuedCount: number;
  failedIndex: number | null;
}

export function useLiveReading(input: {
  enabled: boolean;
  sessionKey?: string;
  userPositionIndex: number;
  assistantPositionIndex: number;
  sourceVerified: boolean;
  retrySignal?: number;
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
  const lastRetrySignal = useRef(input.retrySignal);
  const [state, setState] = useState<LiveReadingQueueState>({
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
        failedIndex.current = next;
        queuedKeys.current.delete(`${input.sessionKey}:${next}`);
        publishState();
        return;
      }
      clearTimeoutRef();
      timeout.current = window.setTimeout(() => {
        if (activeIndex.current !== next) return;
        activeIndex.current = null;
        failedIndex.current = next;
        queuedKeys.current.delete(`${input.sessionKey}:${next}`);
        publishState();
      }, input.retryMs ?? 30_000);
    }).catch(() => {
      if (activeIndex.current !== next) return;
      activeIndex.current = null;
      failedIndex.current = next;
      queuedKeys.current.delete(`${input.sessionKey}:${next}`);
      publishState();
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
    publishState();
  }, [input.enabled, input.sessionKey]);

  useEffect(() => {
    if (lastRetrySignal.current === input.retrySignal) return;
    lastRetrySignal.current = input.retrySignal;
    if (!input.enabled || !input.sourceVerified || !input.sessionKey) return;
    const index = failedIndex.current ?? input.userPositionIndex;
    if (index <= input.assistantPositionIndex || activeIndex.current === index) return;
    const key = `${input.sessionKey}:${index}`;
    clearTimeoutRef();
    failedIndex.current = null;
    queue.current = queue.current.filter((item) => item !== index);
    queuedKeys.current.add(key);
    queue.current.unshift(index);
    publishState();
    pump.current();
  }, [
    input.assistantPositionIndex,
    input.enabled,
    input.retrySignal,
    input.sessionKey,
    input.sourceVerified,
    input.userPositionIndex
  ]);

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
      failedIndex.current = null;
      publishState();
      pump.current();
    }
    const active = activeIndex.current;
    if (active === null || input.assistantPositionIndex < active) return;
    clearTimeoutRef();
    activeIndex.current = null;
    publishState();
    pump.current();
  }, [input.assistantPositionIndex]);

  useEffect(() => () => clearTimeoutRef(), []);

  return state;
}
