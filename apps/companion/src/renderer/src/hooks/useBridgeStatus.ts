import { useCallback, useEffect, useState } from "react";

export function useBridgeStatus(): string | null {
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  const applyConnected = useCallback(async (connected: boolean) => {
    if (connected) {
      setBannerMessage(null);
      return;
    }
    const message = await window.mimica.formatPersonaError("connection");
    setBannerMessage(message);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void window.mimica.getBridgeStatus().then((status) => {
      if (!cancelled) void applyConnected(status.connected);
    });

    const unsub = window.mimica.onBridgeStatusChange((status) => {
      void applyConnected(status.connected);
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [applyConnected]);

  return bannerMessage;
}
