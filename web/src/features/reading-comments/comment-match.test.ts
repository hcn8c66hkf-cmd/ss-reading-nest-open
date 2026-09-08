import { describe, expect, it } from "vitest";
import type { CompanionComment } from "@ss/shared";
import { matchesParagraphComment } from "./comment-match.js";

const comment: CompanionComment = {
  id: "comment-87",
  sessionId: "session-a",
  position: { kind: "paragraph", index: 87, label: "第 87 段" },
  mode: "reaction_only",
  length: "short",
  text: "已经写好的本段吐槽。",
  source: "live_reading",
  operationId: "server-operation-id",
  inRecent: true,
  inHistory: false,
  createdAt: "2026-09-09T00:00:00.000Z"
};

describe("matchesParagraphComment", () => {
  it("accepts a saved comment for the same paragraph even when operation ids differ", () => {
    expect(matchesParagraphComment(comment, "session-a", 87, "client-operation-id"))
      .toBe(true);
  });

  it("does not accept a comment from another paragraph", () => {
    expect(matchesParagraphComment(comment, "session-a", 88, "client-operation-id"))
      .toBe(false);
  });
});
