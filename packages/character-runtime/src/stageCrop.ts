import { MeshAttachment, Physics, type Skeleton, type SkeletonData } from "@esotericsoftware/spine-core";
import type { StageCropRect } from "@mimica/shared";
import { isViewportLetterboxSlot } from "./homeSceneSlots.js";

/** Measured from CH0158_home @ ATLAS_SCALE with Idle_01 (letterbox slots excluded). */
export const RIO_HOME_STAGE_CROP: StageCropRect = {
  x: -1310.74,
  y: -482.66,
  width: 2536.55,
  height: 1917.33,
};

export function cropFromSkeletonData(data: SkeletonData): StageCropRect {
  const insetX = data.width * 0.22;
  const insetY = data.height * 0.18;
  return {
    x: data.x + insetX,
    y: data.y + insetY,
    width: data.width - insetX * 2,
    height: data.height - insetY * 2,
  };
}

export function computeStageCropRect(skeleton: Skeleton): StageCropRect | null {
  skeleton.updateWorldTransform(Physics.update);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let any = false;

  for (const slot of skeleton.slots) {
    if (isViewportLetterboxSlot(slot.data.name)) continue;
    const attachment = slot.getAttachment();
    if (!(attachment instanceof MeshAttachment)) continue;

    const vertexCount = attachment.worldVerticesLength / 2;
    const verts = new Float32Array(attachment.worldVerticesLength);
    attachment.computeWorldVertices(slot, 0, vertexCount, verts, 0, 2);

    for (let i = 0; i < verts.length; i += 2) {
      const x = verts[i];
      const y = verts[i + 1];
      if (x === 0 && y === 0) continue;
      any = true;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (!any || maxX <= minX || maxY <= minY) return null;

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function resolveStageCrop(
  skeleton: Skeleton,
  metadataCrop?: StageCropRect,
): StageCropRect {
  return (
    metadataCrop ??
    computeStageCropRect(skeleton) ??
    cropFromSkeletonData(skeleton.data) ??
    RIO_HOME_STAGE_CROP
  );
}
