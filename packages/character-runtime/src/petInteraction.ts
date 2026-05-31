import {
  MeshAttachment,
  RegionAttachment,
  type Bone,
  type Skeleton,
} from "@esotericsoftware/spine-core";
import type { CharacterPetInteraction, StageCropRect } from "@mimica/shared";

export type PetInteractionPhase = "idle" | "petting" | "returning";

export interface Point2D {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Projects a skeleton-world point into a 2D output space (client/CSS px or Pixi
 * stage px, depending on the caller). The hit region drawn by the live skeleton
 * depends on the crop cover-fit (`SpineStageController.applyCropLayout`), so all
 * coordinate math funnels through such a projector instead of the canvas rect.
 */
export type ProjectWorld = (worldX: number, worldY: number) => Point2D;

export function distanceSq(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return dx * dx + dy * dy;
}

export function rectContains(px: number, py: number, rect: Rect): boolean {
  return (
    px >= rect.x && px <= rect.x + rect.width && py >= rect.y && py <= rect.y + rect.height
  );
}

export function expandRect(rect: Rect, padX: number, padY: number): Rect {
  return {
    x: rect.x - padX,
    y: rect.y - padY,
    width: rect.width + padX * 2,
    height: rect.height + padY * 2,
  };
}

export function boundsToRect(b: Bounds): Rect {
  return { x: b.minX, y: b.minY, width: b.maxX - b.minX, height: b.maxY - b.minY };
}

/** Map a crop-normalized (0–1) coordinate to skeleton-world space. */
export function cropNormalizedToWorld(
  crop: StageCropRect,
  nx: number,
  ny: number,
): Point2D {
  return { x: crop.x + nx * crop.width, y: crop.y + ny * crop.height };
}

/** Project a world-space AABB through `project` and return the bounding output rect. */
export function projectBoundsToRect(bounds: Bounds, project: ProjectWorld): Rect {
  const corners = [
    project(bounds.minX, bounds.minY),
    project(bounds.maxX, bounds.minY),
    project(bounds.maxX, bounds.maxY),
    project(bounds.minX, bounds.maxY),
  ];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of corners) {
    minX = Math.min(minX, c.x);
    minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x);
    maxY = Math.max(maxY, c.y);
  }
  return boundsToRect({ minX, minY, maxX, maxY });
}

/** World-space AABB of the given slots' current attachments (null if none drawable). */
export function slotsWorldBounds(skeleton: Skeleton, slotNames: string[]): Bounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let any = false;

  for (const name of slotNames) {
    const slot = skeleton.findSlot(name);
    if (!slot) continue;
    const attachment = slot.getAttachment();
    let verts: Float32Array;
    if (attachment instanceof MeshAttachment) {
      verts = new Float32Array(attachment.worldVerticesLength);
      attachment.computeWorldVertices(slot, 0, attachment.worldVerticesLength / 2, verts, 0, 2);
    } else if (attachment instanceof RegionAttachment) {
      verts = new Float32Array(8);
      attachment.computeWorldVertices(slot, verts, 0, 2);
    } else {
      continue;
    }
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

  return any ? { minX, minY, maxX, maxY } : null;
}

/** Map cursor X relative to head center to a clamped head rotation (degrees). */
export function computeHeadRotationDeg(
  cursorX: number,
  headCenterX: number,
  swingSpanPx: number,
  maxRotationDeg: number,
): number {
  if (swingSpanPx <= 0 || maxRotationDeg <= 0) return 0;
  const half = swingSpanPx / 2;
  const normalized = (cursorX - headCenterX) / half;
  const clamped = Math.max(-1, Math.min(1, normalized));
  return clamped * maxRotationDeg;
}

/** Lerp current rotation toward target over durationMs. Returns new current value. */
export function lerpRotation(
  current: number,
  target: number,
  dtMs: number,
  durationMs: number,
): number {
  if (durationMs <= 0) return target;
  const t = Math.min(1, dtMs / durationMs);
  return current + (target - current) * t;
}

interface SavedBoneRotation {
  bone: Bone;
  setupRotation: number;
}

interface SavedSlotAttachment {
  slotName: string;
  attachmentName: string | null;
}

export class PetInteractionController {
  private phase: PetInteractionPhase = "idle";
  private readonly config: CharacterPetInteraction;
  private savedBoneRotations: SavedBoneRotation[] = [];
  private savedSlotAttachments: SavedSlotAttachment[] = [];
  private targetRotationDeg = 0;
  private currentRotationDeg = 0;
  private returnElapsedMs = 0;
  private pointerId: number | null = null;
  private headCenterClientX = 0;
  private lookSwingSpanPx = 0;

  constructor(config: CharacterPetInteraction) {
    this.config = config;
  }

  getPhase(): PetInteractionPhase {
    return this.phase;
  }

  isActive(): boolean {
    return this.phase !== "idle";
  }

  /**
   * Resolved head hit region in the projector's output space. Prefers `hitSlots`
   * (live AABB of head slots), then a manual `hitRegionCropNormalized` rect, else
   * null (caller uses the `hitBone` radius fallback). Returns null in the same
   * space as `project` so it can drive screen hit-testing and a debug overlay.
   */
  resolveHeadRect(
    skeleton: Skeleton,
    project: ProjectWorld,
    crop: StageCropRect | null,
  ): Rect | null {
    const padX = this.config.hitPaddingPx ?? 0;
    const padY = padX;

    const slots = this.config.hitSlots;
    if (slots && slots.length > 0) {
      const bounds = slotsWorldBounds(skeleton, slots);
      if (bounds) return expandRect(projectBoundsToRect(bounds, project), padX, padY);
      console.warn(`[PetInteraction] hitSlots produced no bounds: ${slots.join(", ")}`);
    }

    const region = this.config.hitRegionCropNormalized;
    if (region && crop) {
      const bounds: Bounds = {
        minX: Infinity,
        minY: Infinity,
        maxX: -Infinity,
        maxY: -Infinity,
      };
      for (const [nx, ny] of [
        [region.x, region.y],
        [region.x + region.width, region.y],
        [region.x + region.width, region.y + region.height],
        [region.x, region.y + region.height],
      ]) {
        const w = cropNormalizedToWorld(crop, nx, ny);
        bounds.minX = Math.min(bounds.minX, w.x);
        bounds.minY = Math.min(bounds.minY, w.y);
        bounds.maxX = Math.max(bounds.maxX, w.x);
        bounds.maxY = Math.max(bounds.maxY, w.y);
      }
      return expandRect(projectBoundsToRect(bounds, project), padX, padY);
    }

    return null;
  }

  /** Screen-space hit test: head rect (slots/crop rect) preferred, else bone radius. */
  hitTestHead(
    skeleton: Skeleton,
    project: ProjectWorld,
    pointerClientX: number,
    pointerClientY: number,
    crop: StageCropRect | null,
  ): boolean {
    const rect = this.resolveHeadRect(skeleton, project, crop);
    if (rect) return rectContains(pointerClientX, pointerClientY, rect);

    const bone = skeleton.findBone(this.config.hitBone);
    if (!bone) {
      console.warn(`[PetInteraction] hitBone not found: ${this.config.hitBone}`);
      return false;
    }
    const p = project(bone.worldX, bone.worldY);
    const radius = this.config.hitRadiusPx;
    return distanceSq(pointerClientX, pointerClientY, p.x, p.y) <= radius * radius;
  }

  /** Client X the head turn pivots around: head rect center, else look/hit bone. */
  resolveLookCenterClientX(
    skeleton: Skeleton,
    project: ProjectWorld,
    crop: StageCropRect | null,
    fallbackX: number,
  ): number {
    const rect = this.resolveHeadRect(skeleton, project, crop);
    if (rect) return rect.x + rect.width / 2;

    const boneName = this.config.lookBone ?? this.config.hitBone;
    const bone = skeleton.findBone(boneName);
    if (!bone) {
      console.warn(`[PetInteraction] lookBone/hitBone not found: ${boneName}`);
      return fallbackX;
    }
    return project(bone.worldX, bone.worldY).x;
  }

  beginPetting(
    skeleton: Skeleton,
    pointerId: number,
    headCenterClientX: number,
    lookSwingSpanPx: number,
  ): void {
    if (this.phase === "petting") return;
    this.phase = "petting";
    this.pointerId = pointerId;
    this.headCenterClientX = headCenterClientX;
    this.lookSwingSpanPx = lookSwingSpanPx;
    this.targetRotationDeg = 0;
    this.currentRotationDeg = 0;
    this.returnElapsedMs = 0;

    this.savedBoneRotations = [];
    for (const boneName of this.config.headRotationBones) {
      const bone = skeleton.findBone(boneName);
      if (!bone) {
        console.warn(`[PetInteraction] headRotationBone not found: ${boneName}`);
        continue;
      }
      this.savedBoneRotations.push({ bone, setupRotation: bone.rotation });
    }

    // When a pet animation drives the face, skip the one-shot slot swap so the
    // two mechanisms don't fight; expression is the fallback for assets without one.
    if (!this.config.petAnimation) this.applyExpression(skeleton);
  }

  updatePettingCursor(cursorClientX: number): void {
    if (this.phase !== "petting") return;
    this.targetRotationDeg = computeHeadRotationDeg(
      cursorClientX,
      this.headCenterClientX,
      this.lookSwingSpanPx,
      this.config.maxRotationDeg,
    );
    this.currentRotationDeg = this.targetRotationDeg;
  }

  tickPetting(dtMs: number): void {
    if (this.phase !== "petting") return;
    this.currentRotationDeg = lerpRotation(
      this.currentRotationDeg,
      this.targetRotationDeg,
      dtMs,
      50,
    );
  }

  beginReturn(): void {
    if (this.phase === "idle") return;
    this.phase = "returning";
    this.pointerId = null;
    this.targetRotationDeg = 0;
    this.returnElapsedMs = 0;
  }

  tickReturn(dtMs: number): boolean {
    if (this.phase !== "returning") return false;
    this.returnElapsedMs += dtMs;
    this.currentRotationDeg = lerpRotation(
      this.currentRotationDeg,
      0,
      dtMs,
      this.config.returnDurationMs,
    );
    if (this.returnElapsedMs >= this.config.returnDurationMs) {
      this.currentRotationDeg = 0;
      this.phase = "idle";
      return true;
    }
    return false;
  }

  cancel(skeleton: Skeleton): void {
    if (this.phase === "idle") return;
    this.phase = "idle";
    this.pointerId = null;
    this.targetRotationDeg = 0;
    this.currentRotationDeg = 0;
    this.returnElapsedMs = 0;
    this.restoreBoneRotations();
    this.restoreExpression(skeleton);
    this.savedBoneRotations = [];
    this.savedSlotAttachments = [];
  }

  getPointerId(): number | null {
    return this.pointerId;
  }

  getReleaseAnimation(): string | undefined {
    return this.config.releaseAnimation;
  }

  getPetAnimation(): string | undefined {
    return this.config.petAnimation;
  }

  applyBoneOverrides(): void {
    if (this.phase === "idle") return;
    const boneCount = this.savedBoneRotations.length;
    if (boneCount === 0) return;

    const weight = 1 / boneCount;
    for (const { bone, setupRotation } of this.savedBoneRotations) {
      bone.rotation = setupRotation + this.currentRotationDeg * weight;
    }
  }

  finishReturn(skeleton: Skeleton): void {
    this.restoreBoneRotations();
    this.restoreExpression(skeleton);
    this.savedBoneRotations = [];
    this.savedSlotAttachments = [];
  }

  private restoreBoneRotations(): void {
    for (const { bone, setupRotation } of this.savedBoneRotations) {
      bone.rotation = setupRotation;
    }
  }

  private applyExpression(skeleton: Skeleton): void {
    this.savedSlotAttachments = [];
    for (const { slot: slotName, attachment } of this.config.expression?.slots ?? []) {
      const slot = skeleton.findSlot(slotName);
      if (!slot) {
        console.warn(`[PetInteraction] expression slot not found: ${slotName}`);
        continue;
      }
      const current = slot.getAttachment();
      this.savedSlotAttachments.push({
        slotName,
        attachmentName: current?.name ?? null,
      });
      const next = skeleton.getAttachment(slot.data.index, attachment);
      if (!next) {
        console.warn(`[PetInteraction] expression attachment not found: ${slotName}/${attachment}`);
        continue;
      }
      slot.setAttachment(next);
    }
  }

  private restoreExpression(skeleton: Skeleton): void {
    for (const { slotName, attachmentName } of this.savedSlotAttachments) {
      const slot = skeleton.findSlot(slotName);
      if (!slot) continue;
      if (attachmentName === null) {
        slot.setAttachment(null);
        continue;
      }
      const attachment = skeleton.getAttachment(slot.data.index, attachmentName);
      slot.setAttachment(attachment ?? null);
    }
    this.savedSlotAttachments = [];
  }
}
