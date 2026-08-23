import type { ReadingPosition } from "@ss/shared";

export function buildDaddyAnnotationReplyFallbackPrompt(input: {
  conversationPrompt: string;
  sessionId: string;
  position: ReadingPosition;
  operationId: string;
}) {
  return [
    input.conversationPrompt,
    "当前页面宿主不能把生成结果直接交回小窝。请调用 publish_companion_comment 写入你的最终回复后，再在聊天区回复相同内容。",
    `publish_companion_comment 固定参数：${JSON.stringify({
      sessionId: input.sessionId,
      position: input.position,
      mode: "reaction_only",
      length: "short",
      source: "quick_action",
      operationId: input.operationId
    })}；text=你的最终回复全文。`
  ].join("\n\n");
}
