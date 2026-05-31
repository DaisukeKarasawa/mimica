import { useEffect, useState } from "react";

export function useBridgeStatus(): boolean {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    void window.mimica.getBridgeStatus().then((s) => setConnected(s.connected));
    const interval = setInterval(() => {
      void window.mimica.getBridgeStatus().then((s) => setConnected(s.connected));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return connected;
}
