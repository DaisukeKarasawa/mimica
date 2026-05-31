import { useEffect, useRef, useState } from "react";
import type { AvatarState, CharacterAssetStatus } from "@mimica/shared";
import { SpineStageController } from "@mimica/character-runtime";

interface CharacterStageProps {
  avatarState: AvatarState;
  assets: CharacterAssetStatus | null;
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

export function CharacterStage({ avatarState, assets }: CharacterStageProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<SpineStageController | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [spineReady, setSpineReady] = useState(false);

  const petEnabled = Boolean(assets?.metadata?.interaction?.pet);
  const petIdle = avatarState === "idle";

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !assets?.ready || !assets.metadata || !assets.motionMap) {
      setSpineReady(false);
      return;
    }

    let cancelled = false;
    const controller = new SpineStageController();
    controllerRef.current = controller;

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
          setLoadError(null);
          controller.setAvatarState(avatarState);
          requestAnimationFrame(() => {
            if (!cancelled) controller.refreshLayout();
          });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : String(err));
          setSpineReady(false);
        }
      });

    return () => {
      cancelled = true;
      controller.destroy();
      controllerRef.current = null;
      setSpineReady(false);
    };
  }, [
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

  const showPlaceholder = !assets?.ready || !spineReady;
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

      <div className="stage-overlay">
        <span className="stage-hint">
          {loadError
            ? `Spine 読込エラー: ${loadError}`
            : assets?.ready
              ? spineReady
                ? "調月リオ（Spine）"
                : "Spine 読込中…"
              : `素材未配置: ${assets?.missing.join(", ") ?? "metadata.json"}`}
        </span>
      </div>
    </section>
  );
}
