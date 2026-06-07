import { useEffect, useRef, useState } from "react";
import type { AvatarState, CharacterAssetStatus } from "@mimica/shared";
import { SpineStageController } from "@mimica/character-runtime";

interface CharacterStageProps {
  avatarState: AvatarState;
  assets: CharacterAssetStatus | null;
  /** True once the split layout has a stable width (stage host is non-zero). */
  layoutReady?: boolean;
}

function resolvePetDebug(): boolean {
  try {
    const g = globalThis as {
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
    // restricted context
  }
  return false;
}

export function CharacterStage({ avatarState, assets, layoutReady = true }: CharacterStageProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<SpineStageController | null>(null);
  const [spineReady, setSpineReady] = useState(false);
  const [mountError, setMountError] = useState<string | null>(null);

  const petEnabled = Boolean(assets?.metadata?.interaction?.pet);
  const petIdle = avatarState === "idle";

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !layoutReady || !assets?.ready || !assets.metadata || !assets.motionMap) {
      setSpineReady(false);
      setMountError(null);
      return;
    }

    let cancelled = false;
    const controller = new SpineStageController();
    controllerRef.current = controller;
    setMountError(null);

    void controller
      .mount(host, {
        assetBaseUrl: assets.baseUrl,
        metadata: assets.metadata,
        motionMap: assets.motionMap,
        petDebug: resolvePetDebug(),
      })
      .then(() => {
        if (!cancelled) {
          setSpineReady(true);
          controller.setAvatarState(avatarState);
        }
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[CharacterStage] Spine mount failed:", err);
        if (!cancelled) {
          setSpineReady(false);
          setMountError(message);
        }
      });

    return () => {
      cancelled = true;
      controller.destroy();
      controllerRef.current = null;
      setSpineReady(false);
      setMountError(null);
    };
  }, [
    layoutReady,
    assets?.ready,
    assets?.baseUrl,
    assets?.metadata?.skelFile,
    assets?.metadata?.atlasFile,
    assets?.motionMap,
  ]);

  useEffect(() => {
    if (spineReady && controllerRef.current) {
      controllerRef.current.setAvatarState(avatarState);
    }
  }, [avatarState, spineReady]);

  useEffect(() => {
    if (!layoutReady || !spineReady || !controllerRef.current) return;
    requestAnimationFrame(() => {
      controllerRef.current?.refreshLayout();
    });
  }, [layoutReady, spineReady]);

  const showPlaceholder = !assets?.ready || !spineReady;
  const statusMessage = (() => {
    if (!assets) return "キャラクター素材を確認しています…";
    if (!assets.ready) {
      const missing =
        assets.missing.length > 0 ? assets.missing.join(", ") : "metadata / motion-map";
      return `Spine 素材が見つかりません: ${missing}`;
    }
    if (mountError) return `Spine の読み込みに失敗しました: ${mountError}`;
    return null;
  })();

  const stageClassName = [
    "stage",
    spineReady ? "stage--spine-active" : "",
    petEnabled ? "stage--pet-enabled" : "",
    petEnabled && petIdle ? "stage--pet-idle" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={stageClassName} aria-label="キャラクターステージ">
      {showPlaceholder && (
        <>
          <div className="window-glow" />
          <div className="desk" />
        </>
      )}

      <div ref={hostRef} className="spine-host" aria-hidden={showPlaceholder} />

      {statusMessage && (
        <p className="stage-status" role="status">
          {statusMessage}
        </p>
      )}

      {showPlaceholder && (
        <div className={`character placeholder ${avatarState}`} aria-hidden="true">
          <div className="halo" />
          <div className="hair" />
          <div className="head">
            <div className="eye left" />
            <div className="eye right" />
            <div className="mouth" />
          </div>
          <div className="arm left" />
          <div className="arm right" />
          <div className="body" />
        </div>
      )}
    </section>
  );
}
