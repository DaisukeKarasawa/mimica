import type { MotionMap } from "@mimica/shared";

/** カメラ／シーン移動付きのため常時ループに使わない */
export const BLOCKED_ANIMATION_NAMES = new Set(["Start_Idle_01"]);

export function isBlockedAnimation(name: string): boolean {
  return BLOCKED_ANIMATION_NAMES.has(name) || /^Start_Idle/i.test(name);
}

export function isTalkAnimation(name: string): boolean {
  return /^Talk_/i.test(name);
}

/** idle ランダムプール用（Talk_* / Start_Idle_* 以外の Idle_*） */
export function isIdlePoolAnimation(name: string): boolean {
  return /^Idle_/i.test(name) && !isBlockedAnimation(name) && !isTalkAnimation(name);
}

function uniqueNames(names: string[]): string[] {
  return [...new Set(names.filter((n) => n.length > 0))];
}

/** motion-map の idle 定義から待機系プールを構築 */
export function collectIdlePool(motionMap: MotionMap): string[] {
  const entry = motionMap.idle;
  const listed = uniqueNames([...(entry?.animations ?? []), ...(entry?.fallback ?? [])]);
  const idleOnly = listed.filter(isIdlePoolAnimation);
  if (idleOnly.length > 0) return idleOnly;
  return listed.filter((n) => !isTalkAnimation(n) && !isBlockedAnimation(n));
}

/** motion-map の talking 定義から Talk_* プールを構築 */
export function collectTalkPool(motionMap: MotionMap): string[] {
  const entry = motionMap.talking;
  const listed = uniqueNames([...(entry?.animations ?? []), ...(entry?.fallback ?? [])]);
  const talkOnly = listed.filter(isTalkAnimation);
  if (talkOnly.length > 0) return talkOnly;
  return listed.filter((n) => !isBlockedAnimation(n));
}

export function pickRandomAnimation(candidates: string[], avoid?: string): string | undefined {
  if (candidates.length === 0) return undefined;
  let pool = avoid ? candidates.filter((n) => n !== avoid) : candidates;
  if (pool.length === 0) pool = candidates;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

export function filterAnimationsOnSkeleton(
  skeletonData: { findAnimation: (name: string) => unknown },
  names: string[],
): string[] {
  return names.filter((n) => skeletonData.findAnimation(n) != null);
}
