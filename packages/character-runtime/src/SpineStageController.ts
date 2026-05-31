import "@esotericsoftware/spine-pixi-v8";
import { Spine } from "@esotericsoftware/spine-pixi-v8";
import { Physics } from "@esotericsoftware/spine-core";
import type { AvatarState, CharacterMetadata, MotionMap, StageCropRect } from "@mimica/shared";
import { Application, Assets, Container, Graphics, RenderTexture } from "pixi.js";
import { ATLAS_SCALE } from "./atlasScale.js";
import { applyFitPose, stripViewportLetterbox } from "./homeSceneSlots.js";
import {
  collectIdlePool,
  collectTalkPool,
  filterAnimationsOnSkeleton,
  pickRandomAnimation,
} from "./motionPools.js";
import { resolveAvatarAnimations, usesIdleAnimationPool } from "./resolveAnimations.js";
import { computeStageCropRect, maximalOpaqueRect, resolveStageCrop } from "./stageCrop.js";
import { PetInteractionController } from "./petInteraction.js";

export interface SpineStageConfig {
  /** e.g. `mimica-asset://local/` — must end with `/` or will be normalized */
  assetBaseUrl: string;
  metadata: CharacterMetadata;
  motionMap: MotionMap;
}

const RELEASE_TRACK_INDEX = 1;
const RELEASE_MIX_DURATION = 0.15;

export class SpineStageController {
  private static nextMountId = 0;
  private readonly mountId = ++SpineStageController.nextMountId;
  private readonly skelKey: string;
  private readonly atlasKey: string;

  private app: Application | null = null;
  private host: HTMLElement | null = null;
  private stageRoot: Container | null = null;
  private viewContainer: Container | null = null;
  private stageMask: Graphics | null = null;
  private spine: Spine | null = null;
  private metadata: CharacterMetadata | null = null;
  private motionMap: MotionMap | null = null;
  private cachedCrop: StageCropRect | null = null;
  private currentState: AvatarState = "idle";
  private resizeObserver: ResizeObserver | null = null;
  private resizeFrameId = 0;
  private readonly trackIndex = 0;
  private disposed = false;
  private assetsLoaded = false;
  private pendingFitFrames = 0;
  private lastLoopAnimationName: string | null = null;
  private activeLoopPool: "idle" | "talk" | null = null;
  private petController: PetInteractionController | null = null;
  private petTickerBound: (() => void) | null = null;
  private petDebugOverlay: Graphics | null = null;
  private readonly onPointerDown = (event: PointerEvent) => this.handlePointerDown(event);
  private readonly onPointerMove = (event: PointerEvent) => this.handlePointerMove(event);
  private readonly onPointerUp = (event: PointerEvent) => this.handlePointerUp(event);

  constructor() {
    this.skelKey = `mimica-skel-${this.mountId}`;
    this.atlasKey = `mimica-atlas-${this.mountId}`;
  }

  async mount(host: HTMLElement, config: SpineStageConfig): Promise<void> {
    if (this.disposed) throw new Error("SpineStageController is disposed");
    this.host = host;
    this.metadata = config.metadata;
    this.motionMap = config.motionMap;

    const app = new Application();
    await app.init({
      backgroundAlpha: 0,
      resizeTo: host,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });
    host.replaceChildren(app.canvas);
    this.app = app;

    const stageRoot = new Container();
    const stageMask = new Graphics();
    const viewContainer = new Container();
    stageRoot.addChild(stageMask);
    stageRoot.addChild(viewContainer);
    stageRoot.mask = stageMask;
    app.stage.addChild(stageRoot);
    this.stageRoot = stageRoot;
    this.stageMask = stageMask;
    this.viewContainer = viewContainer;

    const base = config.assetBaseUrl.endsWith("/")
      ? config.assetBaseUrl
      : `${config.assetBaseUrl}/`;
    await this.loadSpineAssets(base, config.metadata);

    const spine = Spine.from({
      skeleton: this.skelKey,
      atlas: this.atlasKey,
      scale: ATLAS_SCALE,
      autoUpdate: true,
    });
    spine.pivot.set(0, 0);
    spine.beforeUpdateWorldTransforms = (object) => {
      stripViewportLetterbox(object.skeleton);
      this.petController?.applyBoneOverrides();
      object.spineAttachmentsDirty = true;
    };
    viewContainer.addChild(spine);
    this.spine = spine;

    this.measureCropRect();
    this.fitSpineToStage();
    this.scheduleStageFitRetries();

    this.resizeObserver = new ResizeObserver(() => {
      this.scheduleHostResize();
    });
    this.resizeObserver.observe(host);
    const layoutRoot = host.parentElement;
    if (layoutRoot) {
      this.resizeObserver.observe(layoutRoot);
    }

    this.setAvatarState("idle");

    try {
      this.setupPetInteraction(config.metadata, app.canvas);
    } catch (err) {
      console.error("[SpineStageController] pet interaction setup failed:", err);
    }
  }

  setAvatarState(state: AvatarState): void {
    if (state !== "idle") {
      this.cancelPetInteraction();
    }
    this.currentState = state;
    this.playState(state);
  }

  getAvatarState(): AvatarState {
    return this.currentState;
  }

  /** Re-run layout after the host gains non-zero size (e.g. split pane ready). */
  refreshLayout(): void {
    if (this.disposed) return;
    this.app?.resize();
    this.fitSpineToStage();
    this.scheduleStageFitRetries();
  }

  destroy(): void {
    this.disposed = true;
    this.teardownPetInteraction();
    this.pendingFitFrames = 0;
    if (this.resizeFrameId !== 0) {
      cancelAnimationFrame(this.resizeFrameId);
      this.resizeFrameId = 0;
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.spine) {
      this.spine.beforeUpdateWorldTransforms = () => {};
      this.spine.destroy({ children: true });
      this.spine = null;
    }
    this.stageMask?.destroy();
    this.stageMask = null;
    this.viewContainer?.destroy({ children: true });
    this.viewContainer = null;
    this.stageRoot?.destroy({ children: true });
    this.stageRoot = null;
    if (this.app) {
      this.app.destroy(true, { children: true, texture: true });
      this.app = null;
    }
    if (this.assetsLoaded) {
      void Assets.unload([this.skelKey, this.atlasKey]);
      this.assetsLoaded = false;
    }
    this.host = null;
    this.metadata = null;
    this.motionMap = null;
    this.cachedCrop = null;
  }

  /** Layout size from the mount host (not stale renderer.screen). */
  private stageSize(): { w: number; h: number } {
    const host = this.host;
    if (!host) return { w: 0, h: 0 };
    return { w: host.clientWidth, h: host.clientHeight };
  }

  /** Sync Pixi canvas to host layout, then refit crop — runs after layout settles. */
  private scheduleHostResize(): void {
    if (this.disposed) return;
    if (this.resizeFrameId !== 0) cancelAnimationFrame(this.resizeFrameId);
    this.resizeFrameId = requestAnimationFrame(() => {
      this.resizeFrameId = 0;
      if (this.disposed) return;
      this.app?.resize();
      this.fitSpineToStage();
    });
  }

  /** Host layout can settle after mount; retry fit until dimensions are stable. */
  private scheduleStageFitRetries(frames = 4): void {
    if (this.disposed) return;
    this.pendingFitFrames = frames;
    const tick = () => {
      if (this.disposed || this.pendingFitFrames <= 0) return;
      this.pendingFitFrames -= 1;
      this.app?.resize();
      this.fitSpineToStage();
      if (this.pendingFitFrames === 0) {
        const { w, h } = this.stageSize();
        if (w <= 0 || h <= 0) {
          console.warn(
            "[SpineStageController] Host layout did not stabilize; stage remains empty.",
          );
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  private measureCropRect(): void {
    const spine = this.spine;
    const motionMap = this.motionMap;
    if (!spine || !motionMap) return;

    const fitAnimation = resolveAvatarAnimations("idle", motionMap)[0] ?? "Idle_01";
    applyFitPose(spine.skeleton, fitAnimation);
    stripViewportLetterbox(spine.skeleton);
    spine.skeleton.updateWorldTransform(Physics.update);
    this.cachedCrop =
      this.metadata?.stageCrop ?? this.measureCropFromRender() ?? resolveStageCrop(spine.skeleton);
  }

  /**
   * Ground-truth crop: render the posed scene to an offscreen texture and find the
   * largest fully-opaque axis-aligned rectangle of the *composited* result. Unlike
   * geometry/per-attachment-alpha estimates, this matches exactly what the GPU draws,
   * so dark-but-opaque art (e.g. window frames) counts and the rect never spans a
   * transparent corner. Returns null if rendering/readback is unavailable (headless).
   */
  private measureCropFromRender(): StageCropRect | null {
    const app = this.app;
    const spine = this.spine;
    if (!app || !spine) return null;

    const outer = computeStageCropRect(spine.skeleton);
    if (!outer || outer.width <= 0 || outer.height <= 0) return null;

    const s = 512 / outer.width;
    const tw = Math.max(1, Math.round(outer.width * s));
    const th = Math.max(1, Math.round(outer.height * s));

    const saved = {
      sx: spine.scale.x,
      sy: spine.scale.y,
      px: spine.position.x,
      py: spine.position.y,
    };
    const rt = RenderTexture.create({ width: tw, height: th, resolution: 1 });
    try {
      spine.pivot.set(0, 0);
      spine.scale.set(s);
      spine.position.set(-outer.x * s, -outer.y * s);
      stripViewportLetterbox(spine.skeleton);
      spine.skeleton.updateWorldTransform(Physics.update);
      app.renderer.render({ container: spine, target: rt, clear: true });

      // RenderTexture is flipY=true so extracted row 0 == content top (outer.y).
      const { pixels, width, height } = app.renderer.extract.pixels(rt);
      const opaque = new Uint8Array(width * height);
      for (let i = 0; i < width * height; i++) opaque[i] = pixels[i * 4 + 3] >= 200 ? 1 : 0;

      const rect = maximalOpaqueRect(opaque, width, height, 1);
      if (!rect) return null;
      const crop: StageCropRect = {
        x: outer.x + rect.x0 / s,
        y: outer.y + rect.y0 / s,
        width: (rect.x1 - rect.x0 + 1) / s,
        height: (rect.y1 - rect.y0 + 1) / s,
      };
      // Reject implausibly small results (broken render/readback) → geometry fallback.
      if (crop.width * crop.height < outer.width * outer.height * 0.25) return null;
      return crop;
    } catch {
      return null;
    } finally {
      rt.destroy(true);
      spine.scale.set(saved.sx, saved.sy);
      spine.position.set(saved.px, saved.py);
    }
  }

  /** シーン crop 矩形をステージいっぱいに cover フィット */
  private fitSpineToStage(): void {
    const spine = this.spine;
    const viewContainer = this.viewContainer;
    const stageMask = this.stageMask;
    if (!spine || !viewContainer || !stageMask) return;

    const { w, h } = this.stageSize();
    if (w <= 0 || h <= 0) return;

    stageMask.clear().rect(0, 0, w, h).fill(0xffffff);

    const crop = this.cachedCrop;
    if (!crop || crop.width <= 0 || crop.height <= 0) return;

    this.applyCropLayout(spine, viewContainer, crop, w, h);
  }

  /**
   * crop は skeleton 空間（binary.scale = ATLAS_SCALE 込み）。Pixi 表示は spine.scale でさらに ATLAS_SCALE。
   * getLocalBounds 計測と同じ: fitScale = max(w/(crop*ATLAS)), totalScale = ATLAS_SCALE * fitScale。
   */
  private applyCropLayout(
    spine: Spine,
    viewContainer: Container,
    crop: StageCropRect,
    w: number,
    h: number,
  ): void {
    const fitScale = Math.max(w / (crop.width * ATLAS_SCALE), h / (crop.height * ATLAS_SCALE));
    const totalScale = ATLAS_SCALE * fitScale;
    const scaledW = crop.width * totalScale;
    const scaledH = crop.height * totalScale;

    spine.pivot.set(0, 0);
    spine.scale.set(totalScale);
    spine.position.set(-crop.x * totalScale, -crop.y * totalScale);

    viewContainer.pivot.set(0, 0);
    viewContainer.scale.set(1);
    viewContainer.position.set((w - scaledW) / 2, (h - scaledH) / 2);
    stripViewportLetterbox(spine.skeleton);
  }

  private playState(state: AvatarState): void {
    const spine = this.spine;
    const motionMap = this.motionMap;
    if (!spine || !motionMap) return;

    if (usesIdleAnimationPool(state)) {
      this.activeLoopPool = "idle";
      this.playRandomLoop("idle", state);
      return;
    }

    if (state === "talking") {
      this.activeLoopPool = "talk";
      this.playRandomLoop("talk", state);
      return;
    }

    this.activeLoopPool = null;
    this.lastLoopAnimationName = null;
    this.playOneShot(state);
  }

  private poolCandidates(pool: "idle" | "talk"): string[] {
    const motionMap = this.motionMap!;
    const spine = this.spine!;
    const raw = pool === "idle" ? collectIdlePool(motionMap) : collectTalkPool(motionMap);
    const onSkel = filterAnimationsOnSkeleton(spine.skeleton.data, raw);
    if (onSkel.length > 0) return onSkel;
    const fallback = resolveAvatarAnimations(pool === "idle" ? "idle" : "talking", motionMap);
    return filterAnimationsOnSkeleton(spine.skeleton.data, fallback);
  }

  private setTrack(animName: string, loop: boolean, onComplete?: () => void): boolean {
    const spine = this.spine;
    if (!spine) return false;

    const existingTrack = spine.state.getCurrent(this.trackIndex);
    if (existingTrack?.animation?.name === animName && existingTrack.loop === loop) {
      return false;
    }

    if (existingTrack) existingTrack.listener = {};

    spine.state.setAnimation(this.trackIndex, animName, loop);
    stripViewportLetterbox(spine.skeleton);

    if (onComplete) {
      const track = spine.state.getCurrent(this.trackIndex);
      if (track) {
        track.listener = { complete: onComplete };
      }
    }
    return true;
  }

  private playRandomLoop(
    pool: "idle" | "talk",
    avatarState: AvatarState,
    preferDifferent = false,
  ): void {
    const spine = this.spine;
    if (!spine) return;

    const candidates = this.poolCandidates(pool);
    const animName = pickRandomAnimation(
      candidates,
      preferDifferent ? (this.lastLoopAnimationName ?? undefined) : undefined,
    );
    if (!animName) return;

    const existingTrack = spine.state.getCurrent(this.trackIndex);
    if (
      !preferDifferent &&
      existingTrack?.animation?.name === animName &&
      existingTrack.loop === true &&
      this.activeLoopPool === pool &&
      this.currentState === avatarState
    ) {
      return;
    }

    this.lastLoopAnimationName = animName;
    const expectedPool = pool;
    this.setTrack(animName, true, () => {
      if (this.disposed) return;
      if (this.activeLoopPool !== expectedPool) return;
      if (expectedPool === "idle" && !usesIdleAnimationPool(this.currentState)) return;
      if (expectedPool === "talk" && this.currentState !== "talking") return;
      this.playRandomLoop(expectedPool, this.currentState, candidates.length > 1);
    });
  }

  private playOneShot(state: AvatarState): void {
    const spine = this.spine;
    const motionMap = this.motionMap;
    if (!spine || !motionMap) return;

    const entry = motionMap[state];
    let animName = resolveAvatarAnimations(state, motionMap)[0];
    const loop = entry?.loop ?? true;
    const returnTo = !loop ? entry?.returnTo : undefined;

    if (!animName) {
      animName = resolveAvatarAnimations("idle", motionMap)[0];
      if (!animName) return;
    }

    const onSkel = filterAnimationsOnSkeleton(spine.skeleton.data, [animName]);
    if (onSkel.length === 0) return;
    animName = onSkel[0]!;

    if (!loop && returnTo) {
      const expectedState = state;
      this.setTrack(animName, loop, () => {
        if (this.currentState === expectedState) {
          this.setAvatarState(returnTo);
        }
      });
      return;
    }

    this.setTrack(animName, loop);
  }

  private setupPetInteraction(metadata: CharacterMetadata, canvas: HTMLCanvasElement): void {
    const petConfig = metadata.interaction?.pet;
    if (!petConfig) return;

    this.petController = new PetInteractionController(petConfig);
    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerUp);

    if (this.resolvePetDebugEnabled() && this.stageRoot) {
      const overlay = new Graphics();
      overlay.eventMode = "none";
      this.stageRoot.addChild(overlay);
      this.petDebugOverlay = overlay;
    }

    const app = this.app;
    if (!app) return;
    this.petTickerBound = () => {
      if (this.disposed || !this.petController) return;
      const dt = app.ticker.deltaMS;
      const phase = this.petController.getPhase();
      if (phase === "petting") {
        this.petController.tickPetting(dt);
      } else if (phase === "returning") {
        const spine = this.spine;
        if (!spine) return;
        const done = this.petController.tickReturn(dt);
        if (done) {
          this.petController.finishReturn(spine.skeleton);
        }
      }
      this.updatePetDebugOverlay();
    };
    app.ticker.add(this.petTickerBound);
  }

  /** Skeleton-world point → Pixi stage (logical) coordinates via the live transform. */
  private worldToStage(worldX: number, worldY: number): { x: number; y: number } {
    const spine = this.spine;
    if (!spine) return { x: 0, y: 0 };
    const p = spine.toGlobal({ x: worldX, y: worldY });
    return { x: p.x, y: p.y };
  }

  /**
   * Skeleton-world point → browser client (CSS) coordinates. Scales by
   * `rect.width / screen.width` (logical), so it is correct on HiDPI displays —
   * unlike scaling by the device-pixel canvas backing size.
   */
  private worldToClient(worldX: number, worldY: number): { x: number; y: number } {
    const app = this.app;
    if (!app) return { x: 0, y: 0 };
    const stage = this.worldToStage(worldX, worldY);
    const rect = app.canvas.getBoundingClientRect();
    const sw = app.renderer.screen.width || rect.width;
    const sh = app.renderer.screen.height || rect.height;
    const fx = sw > 0 ? rect.width / sw : 1;
    const fy = sh > 0 ? rect.height / sh : 1;
    return { x: rect.left + stage.x * fx, y: rect.top + stage.y * fy };
  }

  /** Head-turn swing span (client px): full deflection over the crop's width. */
  private lookSwingSpanClientPx(): number {
    const crop = this.cachedCrop;
    const app = this.app;
    if (!crop) return app?.renderer.screen.width ?? 0;
    const midY = crop.y + crop.height / 2;
    const left = this.worldToClient(crop.x, midY);
    const right = this.worldToClient(crop.x + crop.width, midY);
    return Math.abs(right.x - left.x);
  }

  private resolvePetDebugEnabled(): boolean {
    try {
      const g = globalThis as unknown as {
        __MIMICA_PET_DEBUG__?: boolean;
        localStorage?: { getItem?: (k: string) => string | null };
        location?: { search?: string };
      };
      if (g.__MIMICA_PET_DEBUG__ === true) return true;
      if (g.localStorage?.getItem?.("mimica:petDebug")) return true;
      if (typeof g.location?.search === "string" && g.location.search.includes("petDebug")) {
        return true;
      }
    } catch {
      // non-browser / restricted context
    }
    return false;
  }

  private updatePetDebugOverlay(): void {
    const overlay = this.petDebugOverlay;
    const spine = this.spine;
    const petController = this.petController;
    if (!overlay || !spine || !petController) return;

    const rect = petController.resolveHeadRect(
      spine.skeleton,
      (x, y) => this.worldToStage(x, y),
      this.cachedCrop,
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

  private teardownPetInteraction(): void {
    const app = this.app;
    const canvas = app?.canvas;
    if (canvas) {
      canvas.removeEventListener("pointerdown", this.onPointerDown);
      canvas.removeEventListener("pointermove", this.onPointerMove);
      canvas.removeEventListener("pointerup", this.onPointerUp);
      canvas.removeEventListener("pointercancel", this.onPointerUp);
    }
    if (app && this.petTickerBound) {
      app.ticker.remove(this.petTickerBound);
    }
    this.petTickerBound = null;
    this.petController = null;
    if (this.petDebugOverlay) {
      this.petDebugOverlay.destroy();
      this.petDebugOverlay = null;
    }
  }

  private cancelPetInteraction(): void {
    const spine = this.spine;
    if (!this.petController || !spine) return;
    this.petController.cancel(spine.skeleton);
    this.clearReleaseTrack();
  }

  private handlePointerDown(event: PointerEvent): void {
    if (this.currentState !== "idle") return;
    const spine = this.spine;
    const petController = this.petController;
    const app = this.app;
    if (!spine || !petController || !app) return;

    spine.skeleton.updateWorldTransform(Physics.update);
    const project = (x: number, y: number) => this.worldToClient(x, y);
    if (
      !petController.hitTestHead(
        spine.skeleton,
        project,
        event.clientX,
        event.clientY,
        this.cachedCrop,
      )
    ) {
      return;
    }

    const rect = app.canvas.getBoundingClientRect();
    const headCenterX = petController.resolveLookCenterClientX(
      spine.skeleton,
      project,
      this.cachedCrop,
      rect.left + rect.width / 2,
    );
    petController.beginPetting(
      spine.skeleton,
      event.pointerId,
      headCenterX,
      this.lookSwingSpanClientPx(),
    );
    this.playPetAnimation();
    app.canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  /** Loop the authored "being patted" reaction on the release track while petting. */
  private playPetAnimation(): void {
    const spine = this.spine;
    const petController = this.petController;
    if (!spine || !petController) return;

    const animName = petController.getPetAnimation();
    if (!animName) return;

    const onSkel = filterAnimationsOnSkeleton(spine.skeleton.data, [animName]);
    if (onSkel.length === 0) return;

    const entry = spine.state.setAnimation(RELEASE_TRACK_INDEX, onSkel[0]!, true);
    entry.mixDuration = RELEASE_MIX_DURATION;
    stripViewportLetterbox(spine.skeleton);
  }

  private handlePointerMove(event: PointerEvent): void {
    const petController = this.petController;
    if (!petController || petController.getPhase() !== "petting") return;
    if (petController.getPointerId() !== event.pointerId) return;

    petController.updatePettingCursor(event.clientX);
  }

  private handlePointerUp(event: PointerEvent): void {
    const petController = this.petController;
    const spine = this.spine;
    const app = this.app;
    if (!petController || !spine || !app) return;
    if (petController.getPhase() !== "petting") return;
    if (petController.getPointerId() !== event.pointerId) return;

    try {
      app.canvas.releasePointerCapture(event.pointerId);
    } catch {
      // capture may already be released
    }

    petController.beginReturn();
    this.playReleaseAnimation();
  }

  private playReleaseAnimation(): void {
    const spine = this.spine;
    const petController = this.petController;
    if (!spine || !petController) return;

    const animName = petController.getReleaseAnimation();
    if (!animName) return;

    const onSkel = filterAnimationsOnSkeleton(spine.skeleton.data, [animName]);
    if (onSkel.length === 0) return;

    const entry = spine.state.setAnimation(RELEASE_TRACK_INDEX, onSkel[0]!, false);
    entry.mixDuration = RELEASE_MIX_DURATION;
    // Empty the release track once PatEnd finishes so the idle face (track 0)
    // shows through again instead of freezing on PatEnd's last frame.
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
    const spine = this.spine;
    if (!spine) return;
    const track = spine.state.getCurrent(RELEASE_TRACK_INDEX);
    if (track) track.listener = {};
    spine.state.clearTrack(RELEASE_TRACK_INDEX);
    stripViewportLetterbox(spine.skeleton);
  }

  private async loadSpineAssets(base: string, metadata: CharacterMetadata): Promise<void> {
    const skelSrc = `${base}${metadata.skelFile}`;
    const atlasSrc = `${base}${metadata.atlasFile}`;
    Assets.add({ alias: this.skelKey, src: skelSrc });
    Assets.add({ alias: this.atlasKey, src: atlasSrc });
    await Assets.load([this.skelKey, this.atlasKey]);
    this.assetsLoaded = true;
  }
}
