import "@esotericsoftware/spine-pixi-v8";
import { Spine } from "@esotericsoftware/spine-pixi-v8";
import { Physics } from "@esotericsoftware/spine-core";
import type { AvatarState, CharacterMetadata, MotionMap } from "@mimica/shared";
import { Application, Assets } from "pixi.js";
import { ATLAS_SCALE } from "./atlasScale.js";
import { hideHomeSceneSlots } from "./homeSceneSlots.js";
import { resolveAvatarAnimations } from "./resolveAnimations.js";

export interface SpineStageConfig {
  /** e.g. `mimica-asset://local/` — must end with `/` or will be normalized */
  assetBaseUrl: string;
  metadata: CharacterMetadata;
  motionMap: MotionMap;
}

const STAGE_PADDING = 0.06;
const SKEL_KEY = "mimica-skel";
const ATLAS_KEY = "mimica-atlas";

export class SpineStageController {
  private app: Application | null = null;
  private spine: Spine | null = null;
  private motionMap: MotionMap | null = null;
  private currentState: AvatarState = "idle";
  private resizeObserver: ResizeObserver | null = null;
  private readonly trackIndex = 0;
  private disposed = false;
  private assetsLoaded = false;

  async mount(host: HTMLElement, config: SpineStageConfig): Promise<void> {
    if (this.disposed) throw new Error("SpineStageController is disposed");
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
    hideHomeSceneSlots(spine);
    app.stage.addChild(spine);
    this.spine = spine;
    this.fitSpineToStage();

    this.resizeObserver = new ResizeObserver(() => {
      this.fitSpineToStage();
    });
    this.resizeObserver.observe(host);

    this.setAvatarState("idle");
  }

  setAvatarState(state: AvatarState): void {
    this.currentState = state;
    this.playState(state);
  }

  getAvatarState(): AvatarState {
    return this.currentState;
  }

  destroy(): void {
    this.disposed = true;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.spine?.destroy({ children: true });
    this.spine = null;
    if (this.app) {
      this.app.destroy(true, { children: true, texture: true });
      this.app = null;
    }
    if (this.assetsLoaded) {
      void Assets.unload([SKEL_KEY, ATLAS_KEY]);
      this.assetsLoaded = false;
    }
  }

  /** ステージ矩形に収まるよう等倍スケールで中央配置（canvas は resizeTo で歪めない） */
  private fitSpineToStage(): void {
    const app = this.app;
    const spine = this.spine;
    if (!app || !spine) return;

    const w = app.screen.width;
    const h = app.screen.height;
    if (w <= 0 || h <= 0) return;

    spine.skeleton.setToSetupPose();
    hideHomeSceneSlots(spine);
    spine.position.set(0, 0);
    spine.scale.set(ATLAS_SCALE);
    spine.skeleton.updateWorldTransform(Physics.update);

    const bounds = spine.getLocalBounds();
    if (bounds.width <= 0 || bounds.height <= 0) {
      spine.position.set(w / 2, h / 2);
      return;
    }

    const padW = w * STAGE_PADDING;
    const padH = h * STAGE_PADDING;
    const fitScale = Math.min((w - padW * 2) / bounds.width, (h - padH * 2) / bounds.height);
    const totalScale = ATLAS_SCALE * fitScale;

    spine.scale.set(totalScale);
    spine.skeleton.updateWorldTransform(Physics.update);

    const fitted = spine.getLocalBounds();
    const pivotX = fitted.x + fitted.width / 2;
    const pivotY = fitted.y + fitted.height / 2;
    spine.pivot.set(pivotX, pivotY);
    spine.position.set(w / 2, h / 2);
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

    const track = spine.state.setAnimation(this.trackIndex, animName, loop);

    if (!loop && entry?.returnTo) {
      const returnTo = entry.returnTo;
      const expectedState = state;
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
