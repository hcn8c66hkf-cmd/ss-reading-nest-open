import { describe, expect, it } from "vitest";
import { buildDaddyAnnotationReplyFallbackPrompt } from "./reply-fallback.js";

describe("Daddy annotation reply fallback", () => {
  it("writes the reply back to the annotation thread", () => {
    const prompt = buildDaddyAnnotationReplyFallbackPrompt({
      conversationPrompt: "接着回复这句。",
      sessionId: "session-1",
      annotationId: "annotation-1",
      position: { kind: "paragraph", index: 8, label: "第 8 段" },
      operationId: "annotation-daddy-v25:annotation-1:message-1"
    });

    expect(prompt).toContain("接着回复这句。");
    expect(prompt).toContain("调用 publish_companion_comment");
    expect(prompt).toContain('"position":{"kind":"paragraph","index":8,"label":"第 8 段"}');
    expect(prompt).toContain('"operationId":"annotation-daddy-v25:annotation-1:message-1"');
    expect(prompt).toContain("绑定到正确书边");
    expect(prompt).not.toContain("reply_to_annotation");
  });
});
