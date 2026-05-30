import { MixBlend, MixDirection, Physics } from "@esotericsoftware/spine-core";
import type { Skeleton } from "@esotericsoftware/spine-core";
import type { Spine } from "@esotericsoftware/spine-pixi-v8";

/** CH0158_home はメモリーロビ全体。キャラ表示用に背景・家具・画面マスクを非表示にする */
const SCENE_SLOT_PATTERN =
  /^(Wall|Floor|Cabinet|Laptop|Desk|Screen_|Chair|PC_BG|BG|White_[LR]|01_)/;

export function isHomeSceneSlot(slotName: string): boolean {
  return SCENE_SLOT_PATTERN.test(slotName);
}

/** 現在のポーズを維持したままシーン用スロットの attachment だけ外す（アニメ再生中も毎フレーム呼ぶ） */
export function stripHomeSceneAttachments(skeleton: Skeleton): void {
  for (const slot of skeleton.slots) {
    if (isHomeSceneSlot(slot.data.name)) {
      slot.setAttachment(null);
    }
  }
}

/** フィット計測用: setup + シーン除去 + 指定アニメの 0 秒時ポーズ */
export function applyFitPose(skeleton: Skeleton, animationName: string): void {
  skeleton.setToSetupPose();
  stripHomeSceneAttachments(skeleton);
  const animation = skeleton.data.findAnimation(animationName);
  if (animation) {
    animation.apply(skeleton, 0, 0, false, [], 1, MixBlend.setup, MixDirection.mixIn);
  }
  skeleton.updateWorldTransform(Physics.update);
}

/** @deprecated 互換用。新規コードは stripHomeSceneAttachments を使う */
export function hideHomeSceneSlots(spine: Spine): void {
  applyFitPose(spine.skeleton, "Idle_01");
}
