export async function syncCurrentContext(input: {
  context: Record<string, unknown>;
  successPrompt: string;
  fallbackPrompt: string;
  updateModelContext: (context: Record<string, unknown>) => Promise<boolean>;
  sendMessage: (
    prompt: string,
    options?: { scrollToBottom?: boolean }
  ) => Promise<boolean>;
}) {
  const updated = await input.updateModelContext(input.context);
  // A successful ui/update-model-context acknowledgement only means the host
  // accepted the context update. Some mobile hosts still start the follow-up
  // without that context, so the user message must carry the complete policy
  // and writeback instructions as well. Otherwise Daddy can reply in chat but
  // never call publish_companion_comment.
  const sent = await input.sendMessage(input.fallbackPrompt, {
    scrollToBottom: false
  });
  if (!sent) return "failed" as const;
  return updated ? ("context" as const) : ("message-fallback" as const);
}
