export function buildDaddyAnnotationReplyFallbackPrompt(input: {
  conversationPrompt: string;
  sessionId: string;
  annotationId: string;
  operationId: string;
}) {
  return [
    input.conversationPrompt,
    "上面“不写工具调用”只约束最终回复正文的样子，不取消下面这一步保存操作。",
    "当前页面宿主不能把生成结果直接交回小窝。请先调用 reply_to_annotation 把最终回复写进这条划线批注，再在聊天区回复相同内容。不要调用 publish_companion_comment。",
    `reply_to_annotation 固定参数：${JSON.stringify({
      sessionId: input.sessionId,
      annotationId: input.annotationId,
      author: "assistant",
      operationId: input.operationId
    })}；text=你的最终回复全文。`
  ].join("\n\n");
}
