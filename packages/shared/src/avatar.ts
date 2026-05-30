import type { AvatarState } from "./chat.js";

export type { AvatarState };

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
