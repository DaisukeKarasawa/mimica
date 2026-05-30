import type { AvatarState, MotionMap } from "@mimica/shared";

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
    if (!force && next === this.state) return;
    if (!force && next !== this.state && Date.now() - this.lastChangeAt < this.cooldownMs) {
      return;
    }
    this.state = next;
    this.lastChangeAt = Date.now();
    this.onStateChange?.(next);
  }

  resolveAnimations(state: AvatarState, motionMap: MotionMap): string[] {
    const idleAnimations = motionMap.idle?.animations;
    const entry = motionMap[state];
    if (!entry) {
      return idleAnimations?.length ? idleAnimations : [];
    }
    if (entry.animations.length > 0) return entry.animations;
    if (entry.fallback?.length) return entry.fallback;
    return idleAnimations?.length ? idleAnimations : [];
  }
}
