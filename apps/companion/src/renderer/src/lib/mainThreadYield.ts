/** Yield so stream reveal / UI frames can run before heavy work. */
export async function yieldToMain(): Promise<void> {
  const scheduler = (
    globalThis as {
      scheduler?: { yield?: () => Promise<void> };
    }
  ).scheduler;

  if (scheduler?.yield) {
    await scheduler.yield();
    return;
  }

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

/** Run work when the main thread is idle (or after a short timeout). Returns cancel. */
export function scheduleIdleTask(task: () => void, timeoutMs = 120): () => void {
  if (typeof requestIdleCallback !== "undefined") {
    const id = requestIdleCallback(() => task(), { timeout: timeoutMs });
    return () => cancelIdleCallback(id);
  }

  const id = window.setTimeout(task, 0);
  return () => clearTimeout(id);
}
