import type { AvatarState, MotionMap } from "@mimica/shared";
import { resolveAvatarAnimations } from "./resolveAnimations.js";

export interface CharacterDirectorOptions {
  onStateChange?: (state: AvatarState) => void;
  cooldownMs?: number;
}

export class CharacterDirector {
  private state: AvatarState = "idle";
  private readonly cooldownMs: number;
  private readonly onStateChange?: (state: AvatarState) => void;
  private lastChangeAt = 0;

  constructor(options: CharacterDirectorOptions = {}) {
    this.cooldownMs = options.cooldownMs ?? 300;
    this.onStateChange = options.onStateChange;
  }

  getState(): AvatarState {
    return this.state;
  }

  setState(next: AvatarState, force = false): void {
    if (next === this.state) return;
    const isTerminalToIdle =
      next === "idle" &&
      (this.state === "error" || this.state === "success" || this.state === "cancelled");
    if (
      !force &&
      !isTerminalToIdle &&
      next !== this.state &&
      Date.now() - this.lastChangeAt < this.cooldownMs
    ) {
      return;
    }
    this.state = next;
    this.lastChangeAt = Date.now();
    this.onStateChange?.(next);
  }

  resolveAnimations(state: AvatarState, motionMap: MotionMap): string[] {
    return resolveAvatarAnimations(state, motionMap);
  }
}
