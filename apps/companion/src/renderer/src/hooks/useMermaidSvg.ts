import { startTransition, useEffect, useRef, useState } from "react";
import { ensureMermaid } from "../lib/mermaidTheme";
import { scheduleIdleTask, yieldToMain } from "../lib/mainThreadYield";

export interface MermaidSvgState {
  svg: string | null;
  failed: boolean;
}

export function useMermaidSvg(
  source: string,
  renderable: boolean,
  baseId: string,
): MermaidSvgState {
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const renderGenerationRef = useRef(0);
  const lastRenderedSourceRef = useRef<string | null>(null);
  const queuedSourceRef = useRef<string | null>(null);
  const drainingRef = useRef(false);

  const renderSource = source.trim();

  useEffect(() => {
    if (!renderable || !renderSource) {
      return;
    }

    if (lastRenderedSourceRef.current === renderSource) {
      return;
    }

    queuedSourceRef.current = renderSource;
    if (drainingRef.current) {
      return;
    }

    let cancelled = false;

    const drainQueue = async () => {
      if (drainingRef.current) {
        return;
      }
      drainingRef.current = true;

      try {
        const mermaidApi = ensureMermaid();

        do {
          while (!cancelled) {
            const nextSource = queuedSourceRef.current;
            if (!nextSource) {
              break;
            }
            queuedSourceRef.current = null;

            if (lastRenderedSourceRef.current === nextSource) {
              continue;
            }

            const generation = ++renderGenerationRef.current;
            startTransition(() => {
              setFailed(false);
            });

            try {
              await yieldToMain();
              if (cancelled || generation !== renderGenerationRef.current) {
                continue;
              }
              const elementId = `mermaid-${baseId}-${generation}`;
              const { svg: renderedSvg } = await mermaidApi.render(elementId, nextSource);
              if (cancelled || generation !== renderGenerationRef.current) {
                continue;
              }
              lastRenderedSourceRef.current = nextSource;
              startTransition(() => {
                setFailed(false);
                setSvg(renderedSvg);
              });
            } catch (error) {
              if (cancelled || generation !== renderGenerationRef.current) {
                continue;
              }
              console.warn("[MermaidDiagram] render failed", error);
              startTransition(() => {
                setFailed(true);
                setSvg(null);
              });
            }
          }
        } while (!cancelled && queuedSourceRef.current);
      } finally {
        drainingRef.current = false;
        if (!cancelled && queuedSourceRef.current) {
          scheduleIdleTask(() => {
            void drainQueue();
          });
        }
      }
    };

    const cancelSchedule = scheduleIdleTask(() => {
      if (cancelled || drainingRef.current) {
        return;
      }
      void drainQueue();
    });

    return () => {
      cancelled = true;
      cancelSchedule();
    };
  }, [renderSource, renderable, baseId]);

  return { svg, failed };
}
