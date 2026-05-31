import type { Spine } from "@esotericsoftware/spine-pixi-v8";
import { Physics } from "@esotericsoftware/spine-core";
import type { AvatarState, CharacterPetInteraction, StageCropRect } from "@mimica/shared";
import type { Application, Container } from "pixi.js";
import { Graphics } from "pixi.js";
import { stripViewportLetterbox } from "./homeSceneSlots.js";
import { filterAnimationsOnSkeleton } from "./motionPools.js";
import { PetInteractionController } from "./petInteraction.js";

const RELEASE_TRACK_INDEX = 1;
const RELEASE_MIX_DURATION = 0.15;

export interface SpinePetInteractionHostDeps {
  app: Application;
  spine: Spine;
  canvas: HTMLCanvasElement;
  stageRoot: Container;
  getCachedCrop: () => StageCropRect | null;
  getAvatarState: () => AvatarState;
}

export class SpinePetInteractionHost {
  private readonly controller: PetInteractionController;
  private readonly debug: boolean;
  private deps: SpinePetInteractionHostDeps | null = null;
  private tickerBound: (() => void) | null = null;
  private debugOverlay: Graphics | null = null;
  private readonly onPointerDown = (event: PointerEvent) => this.handlePointerDown(event);
  private readonly onPointerMove = (event: PointerEvent) => this.handlePointerMove(event);
  private readonly onPointerUp = (event: PointerEvent) => this.handlePointerUp(event);

  constructor(config: CharacterPetInteraction, options?: { debug?: boolean }) {
    this.controller = new PetInteractionController(config);
    this.debug = options?.debug ?? false;
  }

  attach(deps: SpinePetInteractionHostDeps): void {
    this.deps = deps;
    const { canvas, app, stageRoot } = deps;

    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerUp);

    if (this.debug) {
      const overlay = new Graphics();
      overlay.eventMode = "none";
      stageRoot.addChild(overlay);
      this.debugOverlay = overlay;
    }

    this.tickerBound = () => {
      if (!this.deps) return;
      const phase = this.controller.getPhase();
      if (phase === "returning") {
        const done = this.controller.tickReturn(app.ticker.deltaMS);
        if (done) {
          this.controller.finishReturn();
        }
      }
      this.updateDebugOverlay();
    };
    app.ticker.add(this.tickerBound);
  }

  detach(): void {
    const canvas = this.deps?.canvas;
    if (canvas) {
      canvas.removeEventListener("pointerdown", this.onPointerDown);
      canvas.removeEventListener("pointermove", this.onPointerMove);
      canvas.removeEventListener("pointerup", this.onPointerUp);
      canvas.removeEventListener("pointercancel", this.onPointerUp);
    }
    if (this.deps?.app && this.tickerBound) {
      this.deps.app.ticker.remove(this.tickerBound);
    }
    this.tickerBound = null;
    if (this.debugOverlay) {
      this.debugOverlay.destroy();
      this.debugOverlay = null;
    }
    this.deps = null;
  }

  applyBoneOverrides(): void {
    this.controller.applyBoneOverrides();
  }

  cancel(): void {
    if (!this.deps) return;
    this.controller.cancel();
    this.clearReleaseTrack();
  }

  /** Call when avatar leaves idle so petting stops and bones reset. */
  onNonIdleState(): void {
    this.cancel();
  }

  private worldToStage(worldX: number, worldY: number): { x: number; y: number } {
    const spine = this.deps?.spine;
    if (!spine) return { x: 0, y: 0 };
    const p = spine.toGlobal({ x: worldX, y: worldY });
    return { x: p.x, y: p.y };
  }

  private worldToClient(worldX: number, worldY: number): { x: number; y: number } {
    const app = this.deps?.app;
    if (!app) return { x: 0, y: 0 };
    const stage = this.worldToStage(worldX, worldY);
    const rect = app.canvas.getBoundingClientRect();
    const sw = app.renderer.screen.width || rect.width;
    const sh = app.renderer.screen.height || rect.height;
    const fx = sw > 0 ? rect.width / sw : 1;
    const fy = sh > 0 ? rect.height / sh : 1;
    return { x: rect.left + stage.x * fx, y: rect.top + stage.y * fy };
  }

  private lookSwingSpanClientPx(): number {
    const crop = this.deps?.getCachedCrop() ?? null;
    const app = this.deps?.app;
    if (!crop) return app?.renderer.screen.width ?? 0;
    const midY = crop.y + crop.height / 2;
    const left = this.worldToClient(crop.x, midY);
    const right = this.worldToClient(crop.x + crop.width, midY);
    return Math.abs(right.x - left.x);
  }

  private updateDebugOverlay(): void {
    const overlay = this.debugOverlay;
    const spine = this.deps?.spine;
    if (!overlay || !spine) return;

    const rect = this.controller.resolveHeadRect(
      spine.skeleton,
      (x, y) => this.worldToStage(x, y),
      this.deps?.getCachedCrop() ?? null,
    );
    overlay.clear();
    if (!rect) return;
    overlay.rect(rect.x, rect.y, rect.width, rect.height).stroke({
      width: 2,
      color: 0x36f5b0,
      alpha: 0.9,
    });
    const cx = rect.x + rect.width / 2;
    overlay
      .moveTo(cx, rect.y)
      .lineTo(cx, rect.y + rect.height)
      .stroke({ width: 1, color: 0x36f5b0, alpha: 0.6 });
  }

  private handlePointerDown(event: PointerEvent): void {
    if (this.deps?.getAvatarState() !== "idle") return;
    const { spine, app } = this.deps;
    if (!spine || !app) return;

    spine.skeleton.updateWorldTransform(Physics.update);
    const project = (x: number, y: number) => this.worldToClient(x, y);
    const crop = this.deps.getCachedCrop();
    const rect = app.canvas.getBoundingClientRect();
    const hit = this.controller.resolveHeadHit(
      spine.skeleton,
      project,
      event.clientX,
      event.clientY,
      crop,
      rect.left + rect.width / 2,
    );
    if (!hit.hit) return;

    this.controller.beginPetting(
      spine.skeleton,
      event.pointerId,
      hit.lookCenterClientX,
      this.lookSwingSpanClientPx(),
    );
    this.playPetAnimation();
    app.canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  private handlePointerMove(event: PointerEvent): void {
    if (this.controller.getPhase() !== "petting") return;
    if (this.controller.getPointerId() !== event.pointerId) return;
    this.controller.updatePettingCursor(event.clientX);
  }

  private handlePointerUp(event: PointerEvent): void {
    const { spine, app } = this.deps ?? {};
    if (!spine || !app) return;
    if (this.controller.getPhase() !== "petting") return;
    if (this.controller.getPointerId() !== event.pointerId) return;

    try {
      app.canvas.releasePointerCapture(event.pointerId);
    } catch {
      // capture may already be released
    }

    this.controller.beginReturn();
    this.playReleaseAnimation();
  }

  private playPetAnimation(): void {
    const spine = this.deps?.spine;
    if (!spine) return;

    const animName = this.controller.getPetAnimation();
    if (!animName) return;

    const onSkel = filterAnimationsOnSkeleton(spine.skeleton.data, [animName]);
    if (onSkel.length === 0) return;

    const entry = spine.state.setAnimation(RELEASE_TRACK_INDEX, onSkel[0]!, true);
    entry.mixDuration = RELEASE_MIX_DURATION;
    stripViewportLetterbox(spine.skeleton);
  }

  private playReleaseAnimation(): void {
    const spine = this.deps?.spine;
    if (!spine) return;

    const animName = this.controller.getReleaseAnimation();
    if (!animName) return;

    const onSkel = filterAnimationsOnSkeleton(spine.skeleton.data, [animName]);
    if (onSkel.length === 0) return;

    const entry = spine.state.setAnimation(RELEASE_TRACK_INDEX, onSkel[0]!, false);
    entry.mixDuration = RELEASE_MIX_DURATION;
    entry.listener = {
      complete: () => {
        const current = spine.state.getCurrent(RELEASE_TRACK_INDEX);
        if (current === entry) {
          spine.state.setEmptyAnimation(RELEASE_TRACK_INDEX, RELEASE_MIX_DURATION);
        }
      },
    };
    stripViewportLetterbox(spine.skeleton);
  }

  private clearReleaseTrack(): void {
    const spine = this.deps?.spine;
    if (!spine) return;
    const track = spine.state.getCurrent(RELEASE_TRACK_INDEX);
    if (track) track.listener = {};
    spine.state.clearTrack(RELEASE_TRACK_INDEX);
    stripViewportLetterbox(spine.skeleton);
  }
}
