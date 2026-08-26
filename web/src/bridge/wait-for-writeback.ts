export async function waitForWriteback<T>(input: {
  load: () => Promise<unknown>;
  select: (loaded: unknown) => T | null | undefined;
  attempts?: number;
  intervalMs?: number;
  wait?: (delayMs: number) => Promise<void>;
}): Promise<T | null> {
  const attempts = Math.max(1, input.attempts ?? 20);
  const intervalMs = Math.max(0, input.intervalMs ?? 1_500);
  const wait = input.wait ?? ((delayMs: number) =>
    new Promise<void>((resolve) => window.setTimeout(resolve, delayMs)));

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const selected = input.select(await input.load());
    if (selected !== null && selected !== undefined) return selected;
    if (attempt + 1 < attempts) await wait(intervalMs);
  }
  return null;
}
