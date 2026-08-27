export async function sendLiveReadingFallback(input: {
  prompt: string;
  sendMessage: (
    prompt: string,
    options?: { scrollToBottom?: boolean }
  ) => Promise<boolean>;
}): Promise<"message" | "failed"> {
  const sent = await input.sendMessage(
    input.prompt,
    { scrollToBottom: false }
  );
  if (!sent) return "failed";
  return "message";
}
