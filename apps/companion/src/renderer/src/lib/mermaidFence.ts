const MERMAID_FENCE_OPEN = /^```mermaid\s*$/;
const FENCE_CLOSE = /^```\s*$/;

/**
 * Whether the Nth ```mermaid fence (0-based) in markdown content has a closing ```.
 * Ignores fences inside other code blocks.
 */
export function isMermaidBlockComplete(content: string, blockIndex: number): boolean {
  if (blockIndex < 0) return false;

  let inFence = false;
  let fenceLanguage: string | null = null;
  let mermaidIndex = 0;
  let trackingTarget = false;

  for (const line of content.split("\n")) {
    const trimmed = line.trim();

    if (!inFence) {
      if (MERMAID_FENCE_OPEN.test(trimmed)) {
        if (mermaidIndex === blockIndex) {
          trackingTarget = true;
          inFence = true;
          fenceLanguage = "mermaid";
        }
        mermaidIndex += 1;
      } else if (FENCE_CLOSE.test(trimmed)) {
        // stray close — ignore
      } else if (trimmed.startsWith("```")) {
        inFence = true;
        fenceLanguage = trimmed.slice(3).trim() || "plain";
      }
      continue;
    }

    if (FENCE_CLOSE.test(trimmed)) {
      if (trackingTarget && fenceLanguage === "mermaid") {
        return true;
      }
      inFence = false;
      fenceLanguage = null;
      trackingTarget = false;
    }
  }

  return false;
}

/** Count ```mermaid opening fences in content (ignoring nested plain fences). */
export function countMermaidBlocks(content: string): number {
  let inFence = false;
  let count = 0;

  for (const line of content.split("\n")) {
    const trimmed = line.trim();

    if (!inFence) {
      if (MERMAID_FENCE_OPEN.test(trimmed)) {
        count += 1;
      } else if (trimmed.startsWith("```")) {
        inFence = true;
      }
      continue;
    }

    if (FENCE_CLOSE.test(trimmed)) {
      inFence = false;
    }
  }

  return count;
}
