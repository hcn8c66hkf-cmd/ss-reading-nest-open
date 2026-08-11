import { useEffect, useRef } from "react";

export function useLiveReading(input: {
  enabled: boolean;
  userPositionIndex: number;
  triggerKey?: string;
  isScrolling: boolean;
  sourceVerified: boolean;
  delayMs?: number;
  onStablePosition: (index: number) => void;
}) {
  const sentKeys = useRef(new Set<string>());
  const onStablePosition = useRef(input.onStablePosition);

  useEffect(() => {
    onStablePosition.current = input.onStablePosition;
  }, [input.onStablePosition]);

  useEffect(() => {
    const triggerKey = input.triggerKey ?? String(input.userPositionIndex);
    if (
      !input.enabled ||
      sentKeys.current.has(triggerKey) ||
      input.isScrolling ||
      !input.sourceVerified
    ) {
      return;
    }
    const timer = window.setTimeout(
      () => {
        sentKeys.current.add(triggerKey);
        onStablePosition.current(input.userPositionIndex);
      },
      input.delayMs ?? 1_800
    );
    return () => window.clearTimeout(timer);
  }, [
    input.enabled,
    input.userPositionIndex,
    input.triggerKey,
    input.isScrolling,
    input.sourceVerified,
    input.delayMs
  ]);
}
