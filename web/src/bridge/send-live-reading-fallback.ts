export async function sendLiveReadingFallback(input: {
  context: Record<string, unknown>;
  wakePrompt: string;
  retryPrompt?: string;
  preferRetryPrompt?: boolean;
  compatibilityPrompt: string;
  updateModelContext: (context: Record<string, unknown>) => Promise<boolean>;
  sendMessage: (
    prompt: string,
    options?: { scrollToBottom?: boolean }
  ) => Promise<boolean>;
}): Promise<"context" | "message-fallback" | "failed"> {
  const contextUpdated = await input.updateModelContext(input.context);
  const prompt = contextUpdated
    ? input.preferRetryPrompt && input.retryPrompt
      ? input.retryPrompt
      : input.wakePrompt
    : input.compatibilityPrompt;
  const sent = await input.sendMessage(
    prompt,
    { scrollToBottom: false }
  );
  if (!sent) return "failed";
  return contextUpdated ? "context" : "message-fallback";
}
