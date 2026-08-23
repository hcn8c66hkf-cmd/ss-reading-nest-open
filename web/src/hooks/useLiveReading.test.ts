import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLiveReading } from "./useLiveReading.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("useLiveReading", () => {
  it("queues every paragraph when the user flips faster than Daddy", async () => {
    const onQueuedPosition = vi.fn().mockResolvedValue(true);
    const { result, rerender } = renderHook(
      (props: { user: number; assistant: number }) =>
        useLiveReading({
          enabled: true,
          sessionKey: "session-1:reaction_only:short",
          userPositionIndex: props.user,
          assistantPositionIndex: props.assistant,
          sourceVerified: true,
          onQueuedPosition
        }),
      { initialProps: { user: 2, assistant: 1 } }
    );

    await waitFor(() => expect(onQueuedPosition).toHaveBeenCalledWith(2));
    rerender({ user: 4, assistant: 1 });
    expect(result.current).toMatchObject({ activeIndex: 2, queuedCount: 2, failedIndex: null });

    rerender({ user: 4, assistant: 2 });
    await waitFor(() => expect(onQueuedPosition).toHaveBeenCalledWith(3));
    expect(result.current).toMatchObject({ activeIndex: 3, queuedCount: 1, failedIndex: null });

    rerender({ user: 4, assistant: 3 });
    await waitFor(() => expect(onQueuedPosition).toHaveBeenCalledWith(4));
    expect(result.current).toMatchObject({ activeIndex: 4, queuedCount: 0, failedIndex: null });
  });

  it("does not repeat a paragraph after its short comment confirms completion", async () => {
    const onQueuedPosition = vi.fn().mockResolvedValue(true);
    const { rerender } = renderHook(
      (props: { user: number; assistant: number }) =>
        useLiveReading({
          enabled: true,
          sessionKey: "session-1:reaction_only:short",
          userPositionIndex: props.user,
          assistantPositionIndex: props.assistant,
          sourceVerified: true,
          onQueuedPosition
        }),
      { initialProps: { user: 8, assistant: 7 } }
    );

    await waitFor(() => expect(onQueuedPosition).toHaveBeenCalledTimes(1));
    rerender({ user: 8, assistant: 8 });
    rerender({ user: 8, assistant: 8 });
    expect(onQueuedPosition).toHaveBeenCalledTimes(1);
  });

  it("stays idle while disabled or the source is unavailable", () => {
    const onQueuedPosition = vi.fn();
    const { rerender } = renderHook(
      (props: { enabled: boolean; sourceVerified: boolean }) =>
        useLiveReading({
          enabled: props.enabled,
          sessionKey: "session-1",
          userPositionIndex: 5,
          assistantPositionIndex: 1,
          sourceVerified: props.sourceVerified,
          onQueuedPosition
        }),
      { initialProps: { enabled: false, sourceVerified: true } }
    );

    rerender({ enabled: true, sourceVerified: false });
    expect(onQueuedPosition).not.toHaveBeenCalled();
  });

  it("retries once if no persisted short comment arrives", async () => {
    vi.useFakeTimers();
    const onQueuedPosition = vi.fn().mockResolvedValue(true);
    renderHook(() =>
      useLiveReading({
        enabled: true,
        sessionKey: "session-1",
        userPositionIndex: 3,
        assistantPositionIndex: 2,
        sourceVerified: true,
        retryMs: 1_000,
        onQueuedPosition
      })
    );

    await act(async () => Promise.resolve());
    expect(onQueuedPosition).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.advanceTimersByTime(1_000);
      await Promise.resolve();
    });
    expect(onQueuedPosition).toHaveBeenCalledTimes(2);
  });

  it("surfaces a failed paragraph after one retry and lets the user retry it", async () => {
    vi.useFakeTimers();
    const onQueuedPosition = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(() =>
      useLiveReading({
        enabled: true,
        sessionKey: "session-1",
        userPositionIndex: 3,
        assistantPositionIndex: 2,
        sourceVerified: true,
        retryMs: 1_000,
        onQueuedPosition
      })
    );

    await act(async () => Promise.resolve());
    await act(async () => {
      vi.advanceTimersByTime(1_000);
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(1_000);
      await Promise.resolve();
    });
    expect(onQueuedPosition).toHaveBeenCalledTimes(2);
    expect(result.current.failedIndex).toBe(3);

    act(() => result.current.retryFailed());
    await act(async () => Promise.resolve());
    expect(onQueuedPosition).toHaveBeenCalledTimes(3);
    expect(result.current.failedIndex).toBeNull();
  });
});
