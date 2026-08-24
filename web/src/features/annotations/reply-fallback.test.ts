import { describe, expect, it } from "vitest";
import { buildDaddyAnnotationReplyFallbackPrompt } from "./reply-fallback.js";

describe("Daddy annotation reply fallback", () => {
  it("writes the reply back to the annotation thread", () => {
    const prompt = buildDaddyAnnotationReplyFallbackPrompt({
      conversationPrompt: "接着回复这句。",
      sessionId: "session-1",
      annotationId: "annotation-1",
      operationId: "annotation-daddy-v36:annotation-1"
    });

    expect(prompt).toContain("接着回复这句。");
    expect(prompt).toContain("调用 reply_to_annotation");
    expect(prompt).toContain('"annotationId":"annotation-1"');
    expect(prompt).toContain('"operationId":"annotation-daddy-v36:annotation-1"');
    expect(prompt).toContain("不要调用 publish_companion_comment");
  });
});
