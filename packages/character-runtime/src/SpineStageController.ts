import "@esotericsoftware/spine-pixi-v8";
import { Spine } from "@esotericsoftware/spine-pixi-v8";
import { Physics } from "@esotericsoftware/spine-core";
import type { AvatarState, CharacterMetadata, MotionMap, StageCropRect } from "@mimica/shared";
import { Application, Assets, Container, Graphics, RenderTexture } from "pixi.js";
import { ATLAS_SCALE } from "./atlasScale.js";
import { applyFitPose, stripViewportLetterbox } from "./homeSceneSlots.js";
import { resolveAvatarAnimations } from "./resolveAnimations.js";
import { computeStageCropRect, maximalOpaqueRect, resolveStageCrop } from "./stageCrop.js";

export interface SpineStageConfig {
  /** e.g. `mimica-asset://local/` — must end with `/` or will be normalized */
  assetBaseUrl: string;
  metadata: CharacterMetadata;
  motionMap: MotionMap;
}

const SKEL_KEY = "mimica-skel";
const ATLAS_KEY = "mimica-atlas";

export class SpineStageController {
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
  private readonly trackIndex = 0;
  private disposed = false;
  private assetsLoaded = false;
  private pendingFitFrames = 0;

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
    Assets.add({ alias: SKEL_KEY, src: `${base}${config.metadata.skelFile}` });
    Assets.add({ alias: ATLAS_KEY, src: `${base}${config.metadata.atlasFile}` });
    await Assets.load([SKEL_KEY, ATLAS_KEY]);
    this.assetsLoaded = true;

    const spine = Spine.from({
      skeleton: SKEL_KEY,
      atlas: ATLAS_KEY,
      scale: ATLAS_SCALE,
      autoUpdate: true,
    });
    spine.pivot.set(0, 0);
    spine.beforeUpdateWorldTransforms = (object) => {
      stripViewportLetterbox(object.skeleton);
      object.spineAttachmentsDirty = true;
    };
    viewContainer.addChild(spine);
    this.spine = spine;

    this.measureCropRect();
    this.fitSpineToStage();
    this.scheduleStageFitRetries();

    this.resizeObserver = new ResizeObserver(() => {
      this.fitSpineToStage();
    });
    this.resizeObserver.observe(host);

    this.setAvatarState("idle");
  }

  setAvatarState(state: AvatarState): void {
    this.currentState = state;
    this.playState(state);
    this.scheduleStageFitRetries();
  }

  getAvatarState(): AvatarState {
    return this.currentState;
  }

  destroy(): void {
    this.disposed = true;
    this.pendingFitFrames = 0;
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
      void Assets.unload([SKEL_KEY, ATLAS_KEY]);
      this.assetsLoaded = false;
    }
    this.host = null;
    this.metadata = null;
    this.motionMap = null;
    this.cachedCrop = null;
  }

  private stageSize(): { w: number; h: number } {
    const host = this.host;
    const app = this.app;
    const w = Math.max(host?.clientWidth ?? 0, app?.screen.width ?? 0);
    const h = Math.max(host?.clientHeight ?? 0, app?.screen.height ?? 0);
    return { w, h };
  }

  /** Host layout can settle after mount; retry fit until dimensions are stable. */
  private scheduleStageFitRetries(frames = 4): void {
    if (this.disposed) return;
    this.pendingFitFrames = frames;
    const tick = () => {
      if (this.disposed || this.pendingFitFrames <= 0) return;
      this.pendingFitFrames -= 1;
      this.fitSpineToStage();
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
      this.metadata?.stageCrop ??
      this.measureCropFromRender() ??
      resolveStageCrop(spine.skeleton);
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
    const fitScale = Math.max(
      w / (crop.width * ATLAS_SCALE),
      h / (crop.height * ATLAS_SCALE),
    );
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

    const names = resolveAvatarAnimations(state, motionMap);
    const animName = names[0];
    if (!animName) return;

    const entry = motionMap[state];
    const loop = entry?.loop ?? true;

    const existingTrack = spine.state.getCurrent(this.trackIndex);
    if (existingTrack) existingTrack.listener = {};

    spine.state.setAnimation(this.trackIndex, animName, loop);
    stripViewportLetterbox(spine.skeleton);

    if (!loop && entry?.returnTo) {
      const returnTo = entry.returnTo;
      const expectedState = state;
      const track = spine.state.getCurrent(this.trackIndex);
      if (track) {
        track.listener = {
          complete: () => {
            if (this.currentState === expectedState) {
              this.setAvatarState(returnTo);
            }
          },
        };
      }
    }
  }
}
