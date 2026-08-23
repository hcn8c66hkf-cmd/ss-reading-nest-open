import { describe, expect, it } from "vitest";
import { buildDaddyAnnotationReplyFallbackPrompt } from "./reply-fallback.js";

describe("Daddy annotation reply fallback", () => {
  it("reuses the proven companion-comment tool with an annotation operation id", () => {
    const prompt = buildDaddyAnnotationReplyFallbackPrompt({
      conversationPrompt: "接着回复这句。",
      sessionId: "session-1",
      position: { kind: "paragraph", index: 57, label: "第 57 段" },
      operationId: "annotation-daddy-v25:annotation-1:nonce-1"
    });

    expect(prompt).toContain("接着回复这句。");
    expect(prompt).toContain("调用 publish_companion_comment");
    expect(prompt).toContain('"position":{"kind":"paragraph","index":57,"label":"第 57 段"}');
    expect(prompt).toContain('"operationId":"annotation-daddy-v25:annotation-1:nonce-1"');
    expect(prompt).not.toContain("调用 reply_to_annotation");
  });
});
