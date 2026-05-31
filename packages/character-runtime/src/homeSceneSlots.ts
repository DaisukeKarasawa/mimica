import { MixBlend, MixDirection, Physics } from "@esotericsoftware/spine-core";
import type { Skeleton } from "@esotericsoftware/spine-core";

/** ゲーム画面の左右レターボックス（斜め切りの黒余白）。背景・椅子は残す */
const VIEWPORT_LETTERBOX_PATTERN = /^White_[LR]$/;

export function isViewportLetterboxSlot(slotName: string): boolean {
  return VIEWPORT_LETTERBOX_PATTERN.test(slotName);
}

/** レターボックスだけ外す（ロビ背景・家具は表示したまま） */
export function stripViewportLetterbox(skeleton: Skeleton): void {
  for (const slot of skeleton.slots) {
    if (!isViewportLetterboxSlot(slot.data.name)) continue;
    slot.setAttachment(null);
    slot.color.a = 0;
  }
}

/** フィット計測用: setup + レターボックス除去 + 指定アニメの 0 秒時ポーズ（シーン全体） */
export function applyFitPose(skeleton: Skeleton, animationName: string): void {
  skeleton.setToSetupPose();
  stripViewportLetterbox(skeleton);
  const animation = skeleton.data.findAnimation(animationName);
  if (animation) {
    animation.apply(skeleton, 0, 0, false, [], 1, MixBlend.setup, MixDirection.mixIn);
  }
  stripViewportLetterbox(skeleton);
  skeleton.updateWorldTransform(Physics.update);
}
