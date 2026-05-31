import type { AvatarState, MotionMap } from "@mimica/shared";

/** Resolve Spine animation names for an avatar state (no instance state). */
export function resolveAvatarAnimations(state: AvatarState, motionMap: MotionMap): string[] {
  const idleAnimations = motionMap.idle?.animations;
  const entry = motionMap[state];
  if (!entry) {
    return idleAnimations?.length ? idleAnimations : [];
  }
  if (entry.animations.length > 0) return entry.animations;
  if (entry.fallback?.length) return entry.fallback;
  return idleAnimations?.length ? idleAnimations : [];
}
