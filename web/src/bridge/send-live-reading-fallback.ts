export async function sendLiveReadingFallback(input: {
  prompt: string;
  sendMessage: (
    prompt: string,
    options?: {
      scrollToBottom?: boolean;
      transport?: "auto" | "apps" | "compatibility" | "compatibility-first";
    }
  ) => Promise<boolean>;
}): Promise<"message" | "failed"> {
  const sent = await input.sendMessage(
    input.prompt,
    {
      scrollToBottom: false,
      // ui/message on current iOS hosts can replay the preceding assistant
      // bubble while creating a new turn. Prefer the compatibility follow-up
      // for live reading so each chapter produces one fresh visible reply.
      transport: "compatibility-first"
    }
  );
  if (!sent) return "failed";
  return "message";
}
