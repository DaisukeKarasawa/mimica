import { useCallback, useEffect, useRef, useState } from "react";

export function useBridgeStatus(): string | null {
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const hasEverConnectedRef = useRef(false);
  const generationRef = useRef(0);

  const applyConnected = useCallback(async (connected: boolean, signalGeneration: number) => {
    if (connected) {
      hasEverConnectedRef.current = true;
      setBannerMessage(null);
      return;
    }

    if (!hasEverConnectedRef.current) {
      return;
    }

    try {
      const message = await window.mimica.formatPersonaError("connection");
      if (generationRef.current !== signalGeneration) {
        return;
      }

      const status = await window.mimica.getBridgeStatus();
      if (status.connected || generationRef.current !== signalGeneration) {
        return;
      }

      setBannerMessage(message);
    } catch {
      if (generationRef.current === signalGeneration) {
        setBannerMessage(null);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const handleStatus = (connected: boolean) => {
      generationRef.current += 1;
      const generation = generationRef.current;
      void applyConnected(connected, generation);
    };

    void window.mimica
      .getBridgeStatus()
      .then((status) => {
        if (!cancelled) handleStatus(status.connected);
      })
      .catch(() => {
        if (!cancelled) setBannerMessage(null);
      });

    const unsub = window.mimica.onBridgeStatusChange((status) => {
      if (!cancelled) handleStatus(status.connected);
    });

    return () => {
      cancelled = true;
      generationRef.current += 1;
      unsub();
    };
  }, [applyConnected]);

  return bannerMessage;
}
