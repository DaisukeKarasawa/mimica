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

export interface HeadHitContext {
  hit: boolean;
  lookCenterClientX: number;
}

/**
 * Projects a skeleton-world point into a 2D output space (client/CSS px or Pixi
 * stage px, depending on the caller). The hit region drawn by the live skeleton
 * depends on the crop cover-fit, so all coordinate math funnels through such a
 * projector instead of the canvas rect.
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

function attachmentWorldBounds(
  slot: ReturnType<Skeleton["findSlot"]>,
  attachment: NonNullable<ReturnType<NonNullable<ReturnType<Skeleton["findSlot"]>>["getAttachment"]>>,
): Bounds | null {
  if (!slot) return null;

  let verts: Float32Array;
  if (attachment instanceof MeshAttachment) {
    verts = new Float32Array(attachment.worldVerticesLength);
    attachment.computeWorldVertices(slot, 0, attachment.worldVerticesLength / 2, verts, 0, 2);
  } else if (attachment instanceof RegionAttachment) {
    verts = new Float32Array(8);
    attachment.computeWorldVertices(slot, verts, 0, 2);
  } else {
    return null;
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let allZero = true;

  for (let i = 0; i < verts.length; i += 2) {
    const x = verts[i]!;
    const y = verts[i + 1]!;
    if (x !== 0 || y !== 0) allZero = false;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  if (verts.length === 0 || allZero) return null;
  return { minX, minY, maxX, maxY };
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
    if (!attachment) continue;
    const bounds = attachmentWorldBounds(slot, attachment);
    if (!bounds) continue;
    any = true;
    minX = Math.min(minX, bounds.minX);
    minY = Math.min(minY, bounds.minY);
    maxX = Math.max(maxX, bounds.maxX);
    maxY = Math.max(maxY, bounds.maxY);
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

export class PetInteractionController {
  private phase: PetInteractionPhase = "idle";
  private readonly config: CharacterPetInteraction;
  private savedBoneRotations: SavedBoneRotation[] = [];
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
   * null (caller uses the `hitBone` radius fallback).
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

  /**
   * Single-pass head hit test plus look-center resolution for pointer down.
   * Resolves the head rect once when available.
   */
  resolveHeadHit(
    skeleton: Skeleton,
    project: ProjectWorld,
    pointerClientX: number,
    pointerClientY: number,
    crop: StageCropRect | null,
    fallbackLookCenterX: number,
  ): HeadHitContext {
    const rect = this.resolveHeadRect(skeleton, project, crop);
    if (rect) {
      return {
        hit: rectContains(pointerClientX, pointerClientY, rect),
        lookCenterClientX: rect.x + rect.width / 2,
      };
    }

    const bone = skeleton.findBone(this.config.hitBone);
    if (!bone) {
      console.warn(`[PetInteraction] hitBone not found: ${this.config.hitBone}`);
      return { hit: false, lookCenterClientX: fallbackLookCenterX };
    }
    const p = project(bone.worldX, bone.worldY);
    const radius = this.config.hitRadiusPx;
    const hit = distanceSq(pointerClientX, pointerClientY, p.x, p.y) <= radius * radius;
    if (!hit) {
      return { hit: false, lookCenterClientX: fallbackLookCenterX };
    }
    const lookBoneName = this.config.lookBone ?? this.config.hitBone;
    const lookBone = skeleton.findBone(lookBoneName);
    const lookCenterClientX = lookBone
      ? project(lookBone.worldX, lookBone.worldY).x
      : p.x;
    return { hit: true, lookCenterClientX };
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
  }

  updatePettingCursor(cursorClientX: number): void {
    if (this.phase !== "petting") return;
    this.currentRotationDeg = computeHeadRotationDeg(
      cursorClientX,
      this.headCenterClientX,
      this.lookSwingSpanPx,
      this.config.maxRotationDeg,
    );
  }

  beginReturn(): void {
    if (this.phase === "idle") return;
    this.phase = "returning";
    this.pointerId = null;
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
      return true;
    }
    return false;
  }

  cancel(): void {
    if (this.phase === "idle") return;
    this.phase = "idle";
    this.pointerId = null;
    this.currentRotationDeg = 0;
    this.returnElapsedMs = 0;
    this.restoreBoneRotations();
    this.savedBoneRotations = [];
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

  /**
   * Distributes `currentRotationDeg` evenly across configured head bones so the
   * combined visual turn matches `maxRotationDeg` at full deflection.
   */
  applyBoneOverrides(): void {
    if (this.phase === "idle") return;
    const boneCount = this.savedBoneRotations.length;
    if (boneCount === 0) return;

    const weight = 1 / boneCount;
    for (const { bone, setupRotation } of this.savedBoneRotations) {
      bone.rotation = setupRotation + this.currentRotationDeg * weight;
    }
  }

  finishReturn(): void {
    this.phase = "idle";
    this.restoreBoneRotations();
    this.savedBoneRotations = [];
  }

  private restoreBoneRotations(): void {
    for (const { bone, setupRotation } of this.savedBoneRotations) {
      bone.rotation = setupRotation;
    }
  }
}
