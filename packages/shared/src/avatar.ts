import type { AvatarState } from "./chat.js";

export type { AvatarState };

/** Single source for avatar UI copy (status bar vs stage badge). */
export const AVATAR_STATE_LABELS: Record<AvatarState, { status: string; badge: string }> = {
  idle: { status: "Idle", badge: "Idle" },
  thinking: { status: "Thinking…", badge: "Thinking" },
  talking: { status: "Responding", badge: "Responding" },
  success: { status: "Done", badge: "Done" },
  error: { status: "Error", badge: "Error" },
  waiting: { status: "Awaiting input", badge: "Awaiting" },
  cancelled: { status: "Cancelled", badge: "Cancelled" },
};

export function avatarStatusLabel(state: AvatarState): string {
  return AVATAR_STATE_LABELS[state].status;
}

export function avatarBadgeLabel(state: AvatarState): string {
  return AVATAR_STATE_LABELS[state].badge;
}

export interface MotionMapEntry {
  loop: boolean;
  animations: string[];
  fallback?: string[];
  returnTo?: AvatarState;
}

export type MotionMap = Record<AvatarState, MotionMapEntry>;

/** Axis-aligned crop in skeleton space (with ATLAS_SCALE). Overrides auto bounds when set. */
export interface StageCropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CharacterPetHitRegion {
  /** Left edge, 0–1 relative to the stage crop rect (not the full canvas) */
  x: number;
  /** Top edge, 0–1 relative to the stage crop rect (not the full canvas) */
  y: number;
  width: number;
  height: number;
}

export interface CharacterPetInteraction {
  /**
   * Head hit region from the live AABB of these slots (preferred). Self-corrects
   * across crop cover-fit and resize; e.g. `["Head"]`. Falls back to
   * `hitRegionCropNormalized`, then the `hitBone` radius.
   */
  hitSlots?: string[];
  /**
   * Manual hit rect in stage-crop-normalized space (0–1 of the crop rect, which
   * is what is actually drawn — NOT the full canvas). Used when `hitSlots` is
   * unset or yields no bounds.
   */
  hitRegionCropNormalized?: CharacterPetHitRegion;
  /** Extra forgiveness (px) added around the resolved head rect. */
  hitPaddingPx?: number;
  /** Point hit fallback when neither hitSlots nor hitRegionCropNormalized resolves */
  hitBone: string;
  /** Bones rotated together during petting; rotation is split evenly across them. */
  headRotationBones: string[];
  maxRotationDeg: number;
  returnDurationMs: number;
  hitRadiusPx: number;
  /** Client-X origin for head turn; defaults to head-rect center, else this bone */
  lookBone?: string;
  /**
   * Authored "being patted" reaction looped on the release track while petting
   * (e.g. `"Pat_01_A"`). Drives the face/blush/closed-eyes; head-turn bones are
   * still overridden for cursor follow.
   */
  petAnimation?: string;
  releaseAnimation?: string;
}

export interface CharacterInteractionConfig {
  pet: CharacterPetInteraction;
}

export interface CharacterMetadata {
  id: string;
  displayName: string;
  /** Short name for UI copy (e.g. 調月リオ → リオ). Falls back to displayName when omitted. */
  shortDisplayName?: string;
  /** Romanized short name for English UI copy (e.g. Rio). */
  shortDisplayNameEn?: string;
  skelFile: string;
  atlasFile: string;
  /** Optional fixed crop; otherwise computed from drawable slots (letterbox excluded). */
  stageCrop?: StageCropRect;
  /** Memorial-lobby-style idle interactions (pet head follow, etc.). */
  interaction?: CharacterInteractionConfig;
}
