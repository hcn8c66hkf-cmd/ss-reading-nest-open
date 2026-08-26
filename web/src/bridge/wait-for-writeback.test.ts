import { describe, expect, it, vi } from "vitest";
import { waitForWriteback } from "./wait-for-writeback.js";

describe("waitForWriteback", () => {
  it("returns only after the requested persisted value appears", async () => {
    const load = vi.fn()
      .mockResolvedValueOnce({ comments: [] })
      .mockResolvedValueOnce({ comments: [{ operationId: "op-1" }] });
    const wait = vi.fn().mockResolvedValue(undefined);

    const result = await waitForWriteback({
      load,
      select: (loaded) => {
        const comments = (loaded as { comments: Array<{ operationId: string }> }).comments;
        return comments.find((comment) => comment.operationId === "op-1");
      },
      attempts: 3,
      wait
    });

    expect(result).toEqual({ operationId: "op-1" });
    expect(load).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledTimes(1);
  });

  it("returns null after the writeback deadline instead of treating delivery as completion", async () => {
    const load = vi.fn().mockResolvedValue({ comments: [] });
    const wait = vi.fn().mockResolvedValue(undefined);

    const result = await waitForWriteback({
      load,
      select: () => null,
      attempts: 3,
      wait
    });

    expect(result).toBeNull();
    expect(load).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenCalledTimes(2);
  });
});
