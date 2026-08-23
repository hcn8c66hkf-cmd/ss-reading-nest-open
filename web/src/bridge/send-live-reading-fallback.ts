export async function sendLiveReadingFallback(input: {
  context: Record<string, unknown>;
  wakePrompt: string;
  compatibilityPrompt: string;
  updateModelContext: (context: Record<string, unknown>) => Promise<boolean>;
  sendMessage: (
    prompt: string,
    options?: { scrollToBottom?: boolean }
  ) => Promise<boolean>;
}): Promise<"context" | "message-fallback" | "failed"> {
  const contextUpdated = await input.updateModelContext(input.context);
  const sent = await input.sendMessage(
    contextUpdated ? input.wakePrompt : input.compatibilityPrompt,
    { scrollToBottom: false }
  );
  if (!sent) return "failed";
  return contextUpdated ? "context" : "message-fallback";
}
