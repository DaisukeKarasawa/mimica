import { Physics } from "@esotericsoftware/spine-core";
import type { Spine } from "@esotericsoftware/spine-pixi-v8";

/** CH0158_home はメモリーロビ全体。キャラ表示用に背景・家具スロットを非表示にする */
const SCENE_SLOT_PATTERN =
  /^(Wall|Floor|Cabinet|Laptop|Desk|Screen_|Chair|PC_BG|BG|01_)/;

export function hideHomeSceneSlots(spine: Spine): void {
  const skeleton = spine.skeleton;
  skeleton.setSlotsToSetupPose();
  for (const slot of skeleton.slots) {
    if (SCENE_SLOT_PATTERN.test(slot.data.name)) {
      slot.setAttachment(null);
    }
  }
  skeleton.updateWorldTransform(Physics.update);
}
