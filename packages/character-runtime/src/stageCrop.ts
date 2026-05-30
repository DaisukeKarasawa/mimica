import {
  MeshAttachment,
  Physics,
  RegionAttachment,
  type Skeleton,
  type SkeletonData,
} from "@esotericsoftware/spine-core";
import type { StageCropRect } from "@mimica/shared";
import { isViewportLetterboxSlot } from "./homeSceneSlots.js";

/**
 * Largest inscribed (opaque) rectangle of CH0158_home @ ATLAS_SCALE with Idle_01,
 * measured in spine-pixi y-down skeleton space (letterbox slots excluded).
 * Used as a fallback; `computeInscribedStageCrop` recomputes from the live skeleton.
 */
export const RIO_HOME_STAGE_CROP: StageCropRect = {
  x: -734.73,
  y: -1334.27,
  width: 1833.72,
  height: 1495.51,
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

/** Append the two triangles of a quad attachment's world vertices to `tris`. */
function pushQuad(verts: Float32Array, tris: number[]): void {
  tris.push(verts[0], verts[1], verts[2], verts[3], verts[4], verts[5]);
  tris.push(verts[0], verts[1], verts[4], verts[5], verts[6], verts[7]);
}

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Gather world-space triangles of all drawable, non-letterbox attachments. */
function collectTriangles(skeleton: Skeleton): { tris: number[]; bounds: Bounds } {
  const tris: number[] = [];
  const b: Bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const track = (x: number, y: number) => {
    if (x < b.minX) b.minX = x;
    if (y < b.minY) b.minY = y;
    if (x > b.maxX) b.maxX = x;
    if (y > b.maxY) b.maxY = y;
  };

  for (const slot of skeleton.slots) {
    if (isViewportLetterboxSlot(slot.data.name)) continue;
    const attachment = slot.getAttachment();
    if (attachment instanceof MeshAttachment) {
      const length = attachment.worldVerticesLength;
      const world = new Float32Array(length);
      attachment.computeWorldVertices(slot, 0, length / 2, world, 0, 2);
      const indices = attachment.triangles;
      for (let i = 0; i < indices.length; i += 3) {
        const a = indices[i] * 2;
        const c = indices[i + 1] * 2;
        const d = indices[i + 2] * 2;
        tris.push(world[a], world[a + 1], world[c], world[c + 1], world[d], world[d + 1]);
      }
      for (let i = 0; i < length; i += 2) track(world[i], world[i + 1]);
    } else if (attachment instanceof RegionAttachment) {
      const world = new Float32Array(8);
      attachment.computeWorldVertices(slot, world, 0, 2);
      pushQuad(world, tris);
      for (let i = 0; i < 8; i += 2) track(world[i], world[i + 1]);
    }
  }
  return { tris, bounds: b };
}

function edge(ax: number, ay: number, bx: number, by: number, px: number, py: number): number {
  return (px - ax) * (by - ay) - (py - ay) * (bx - ax);
}

/** Largest all-filled axis-aligned rectangle in a binary grid (histogram method). */
function maximalRectangle(
  grid: Uint8Array,
  gw: number,
  gh: number,
): { x0: number; y0: number; x1: number; y1: number } | null {
  const heights = new Uint16Array(gw);
  let bestArea = 0;
  let best: { x0: number; y0: number; x1: number; y1: number } | null = null;
  const stack: { i: number; h: number }[] = [];

  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      heights[gx] = grid[gy * gw + gx] ? heights[gx] + 1 : 0;
    }
    stack.length = 0;
    for (let gx = 0; gx <= gw; gx++) {
      const h = gx === gw ? 0 : heights[gx];
      let start = gx;
      while (stack.length && stack[stack.length - 1].h >= h) {
        const top = stack.pop()!;
        const area = top.h * (gx - top.i);
        if (area > bestArea) {
          bestArea = area;
          best = { x0: top.i, y0: gy - top.h + 1, x1: gx - 1, y1: gy };
        }
        start = top.i;
      }
      stack.push({ i: start, h });
    }
  }
  return best;
}

/**
 * Largest axis-aligned rectangle fully inside the opaque (drawn) region of the
 * scene — the asset's edges are irregular (diagonal letterbox cuts), so the outer
 * bounding box would expose transparent corners. Rasterizes attachment triangles
 * into a coverage grid and finds the maximal all-covered rectangle, in skeleton
 * space (binary.scale applied, y-down to match spine-pixi rendering).
 */
export function computeInscribedStageCrop(
  skeleton: Skeleton,
  gridWidth = 480,
): StageCropRect | null {
  skeleton.updateWorldTransform(Physics.update);
  const { tris, bounds } = collectTriangles(skeleton);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  if (!(width > 0) || !(height > 0)) return null;

  const cell = width / gridWidth;
  const gw = gridWidth;
  const gh = Math.max(1, Math.round(height / cell));
  const grid = new Uint8Array(gw * gh);

  for (let t = 0; t < tris.length; t += 6) {
    const x0 = tris[t], y0 = tris[t + 1];
    const x1 = tris[t + 2], y1 = tris[t + 3];
    const x2 = tris[t + 4], y2 = tris[t + 5];
    const area = edge(x0, y0, x1, y1, x2, y2);
    if (area === 0) continue;
    const sign = area > 0 ? 1 : -1;
    const loX = Math.max(0, Math.floor((Math.min(x0, x1, x2) - bounds.minX) / cell));
    const hiX = Math.min(gw - 1, Math.ceil((Math.max(x0, x1, x2) - bounds.minX) / cell));
    const loY = Math.max(0, Math.floor((Math.min(y0, y1, y2) - bounds.minY) / cell));
    const hiY = Math.min(gh - 1, Math.ceil((Math.max(y0, y1, y2) - bounds.minY) / cell));
    for (let gy = loY; gy <= hiY; gy++) {
      const py = bounds.minY + (gy + 0.5) * cell;
      for (let gx = loX; gx <= hiX; gx++) {
        const px = bounds.minX + (gx + 0.5) * cell;
        const w0 = edge(x1, y1, x2, y2, px, py) * sign;
        const w1 = edge(x2, y2, x0, y0, px, py) * sign;
        const w2 = edge(x0, y0, x1, y1, px, py) * sign;
        if (w0 >= 0 && w1 >= 0 && w2 >= 0) grid[gy * gw + gx] = 1;
      }
    }
  }

  const rect = maximalRectangle(grid, gw, gh);
  if (!rect) return null;
  return {
    x: bounds.minX + rect.x0 * cell,
    y: bounds.minY + rect.y0 * cell,
    width: (rect.x1 - rect.x0 + 1) * cell,
    height: (rect.y1 - rect.y0 + 1) * cell,
  };
}

export function resolveStageCrop(
  skeleton: Skeleton,
  metadataCrop?: StageCropRect,
): StageCropRect {
  return (
    metadataCrop ??
    computeInscribedStageCrop(skeleton) ??
    computeStageCropRect(skeleton) ??
    cropFromSkeletonData(skeleton.data) ??
    RIO_HOME_STAGE_CROP
  );
}
