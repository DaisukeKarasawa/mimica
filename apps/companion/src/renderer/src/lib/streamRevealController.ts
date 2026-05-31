import {
  advanceRevealCount,
  codePointCount,
  sliceByCodePoints,
  STREAM_REVEAL_CHARS_PER_SECOND,
} from "./streamReveal";

export interface StreamRevealContext {
  sessionId: string;
  runId: string;
  streamId: string;
}

export interface PendingStreamComplete {
  sessionId: string;
  runId: string;
  streamId: string;
  content: string;
}

export interface StreamRevealControllerOptions {
  onFrame: (ctx: StreamRevealContext, displayedContent: string) => void;
  onFinalize: (pending: PendingStreamComplete) => void;
}

export class StreamRevealController {
  private receivedContent = "";
  private revealedCount = 0;
  private revealCarry = 0;
  private lastRevealTickAt = 0;
  private rafId = 0;
  private context: StreamRevealContext | null = null;
  private pendingComplete: PendingStreamComplete | null = null;

  constructor(private readonly options: StreamRevealControllerOptions) {}

  setContext(ctx: StreamRevealContext): void {
    this.context = ctx;
  }

  getContext(): StreamRevealContext | null {
    return this.context;
  }

  appendReceived(chunk: string): void {
    this.receivedContent += chunk;
  }

  setReceivedIfLonger(content: string): void {
    if (codePointCount(content) >= codePointCount(this.receivedContent)) {
      this.receivedContent = content;
    }
  }

  getReceivedContent(): string {
    return this.receivedContent;
  }

  /** 表示中の reveal を止め、キュー済み complete があれば最長本文で返す（success 演出は呼び出し側） */
  drainPendingComplete(): PendingStreamComplete | null {
    const pending = this.pendingComplete;
    if (!pending) return null;
    this.pendingComplete = null;
    this.stop();
    return {
      ...pending,
      content: this.resolveFinalizeContent(pending.content),
    };
  }

  queueComplete(pending: PendingStreamComplete): void {
    this.pendingComplete = pending;
  }

  start(): void {
    if (this.rafId !== 0) return;
    if (this.lastRevealTickAt === 0) {
      this.lastRevealTickAt = Date.now();
    }
    this.rafId = requestAnimationFrame(() => this.tick());
  }

  stop(): void {
    if (this.rafId !== 0) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  reset(): void {
    this.stop();
    this.pendingComplete = null;
    this.receivedContent = "";
    this.revealedCount = 0;
    this.revealCarry = 0;
    this.lastRevealTickAt = 0;
    this.context = null;
  }

  getDisplayedContent(): string {
    return sliceByCodePoints(this.receivedContent, this.revealedCount);
  }

  private displayedContent(): string {
    return this.getDisplayedContent();
  }

  private tick(): void {
    this.rafId = 0;

    const now = Date.now();
    if (this.lastRevealTickAt === 0) {
      this.lastRevealTickAt = now;
    }
    const deltaMs = now - this.lastRevealTickAt;
    this.lastRevealTickAt = now;

    const receivedCount = codePointCount(this.receivedContent);
    const advanced = advanceRevealCount(
      this.revealedCount,
      receivedCount,
      deltaMs,
      STREAM_REVEAL_CHARS_PER_SECOND,
      this.revealCarry,
    );
    this.revealCarry = advanced.carry;

    const ctx = this.context;
    if (advanced.revealed > this.revealedCount) {
      this.revealedCount = advanced.revealed;
      if (ctx) {
        this.options.onFrame(ctx, this.displayedContent());
      }
    }

    const caughtUp = this.revealedCount >= receivedCount;
    const pending = this.pendingComplete;
    if (pending && caughtUp) {
      this.pendingComplete = null;
      this.stop();
      this.options.onFinalize({
        ...pending,
        content: this.resolveFinalizeContent(pending.content),
      });
      this.reset();
      return;
    }

    if (!caughtUp || pending) {
      this.rafId = requestAnimationFrame(() => this.tick());
    }
  }

  private resolveFinalizeContent(queuedContent: string): string {
    return codePointCount(this.receivedContent) >= codePointCount(queuedContent)
      ? this.receivedContent
      : queuedContent;
  }
}
