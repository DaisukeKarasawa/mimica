import type { CharacterMetadata, MotionMap } from "./avatar.js";

export interface CharacterAssetStatus {
  baseUrl: string;
  assetRoot: string;
  ready: boolean;
  missing: string[];
  metadata: CharacterMetadata | null;
  motionMap: MotionMap | null;
  chatIconUrl: string | null;
}
