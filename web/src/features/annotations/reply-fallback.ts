import type { ReadingPosition } from "@ss/shared";

export function buildDaddyAnnotationReplyFallbackPrompt(input: {
  conversationPrompt: string;
  sessionId: string;
  annotationId: string;
  position: ReadingPosition;
  operationId: string;
}) {
  return [
    input.conversationPrompt,
    "上面“不写工具调用”只约束最终回复正文的样子，不取消下面这一步保存操作。",
    "当前页面宿主不能把生成结果直接交回小窝。请先生成最终回复，再调用 publish_companion_comment 把完全相同的文字写进这条划线批注；写回成功后在聊天区回复相同内容。",
    `publish_companion_comment 的固定参数：${JSON.stringify({
      sessionId: input.sessionId,
      position: input.position,
      mode: "light_chat",
      length: "short",
      source: "current_context",
      operationId: input.operationId
    })}；text=你的最终回复全文。operationId 已把批注 ${input.annotationId} 绑定到正确书边，请勿改动。`
  ].join("\n\n");
}
