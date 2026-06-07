import { useEffect, useState } from "react";
import type { CharacterAssetStatus } from "@mimica/shared";

const MAX_ASSET_LOAD_ATTEMPTS = 8;
const ASSET_LOAD_RETRY_MS = 1500;

export function useCharacterAssets(): CharacterAssetStatus | null {
  const [characterAssets, setCharacterAssets] = useState<CharacterAssetStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const loadAssets = async (attempt = 0) => {
      try {
        const status = await window.mimica.getCharacterAssets();
        if (cancelled) return;
        setCharacterAssets(status);
        if (!status.ready && attempt < MAX_ASSET_LOAD_ATTEMPTS) {
          retryTimer = setTimeout(() => void loadAssets(attempt + 1), ASSET_LOAD_RETRY_MS);
        }
      } catch (error) {
        if (cancelled) return;
        if (attempt < MAX_ASSET_LOAD_ATTEMPTS) {
          retryTimer = setTimeout(() => void loadAssets(attempt + 1), ASSET_LOAD_RETRY_MS);
          return;
        }
        console.error("[useCharacterAssets] failed to fetch character assets:", error);
      }
    };

    void loadAssets();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, []);

  return characterAssets;
}
