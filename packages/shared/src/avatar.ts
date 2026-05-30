import type { AvatarState } from "./chat.js";

export type { AvatarState };

/** Single source for avatar UI copy (status bar vs stage badge). */
export const AVATAR_STATE_LABELS: Record<AvatarState, { status: string; badge: string }> = {
  idle: { status: "待機中", badge: "待機" },
  thinking: { status: "考え中…", badge: "考え中" },
  talking: { status: "回答中", badge: "回答中" },
  success: { status: "完了", badge: "完了" },
  error: { status: "エラー", badge: "エラー" },
  waiting: { status: "確認待ち", badge: "確認待ち" },
  cancelled: { status: "中断", badge: "中断" },
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

export interface CharacterMetadata {
  id: string;
  displayName: string;
  skelFile: string;
  atlasFile: string;
}
