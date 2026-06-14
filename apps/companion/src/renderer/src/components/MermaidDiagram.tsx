import mermaid from "mermaid";
import { startTransition, useEffect, useId, useRef, useState } from "react";
import { scheduleIdleTask, yieldToMain } from "../lib/mainThreadYield";
import { MermaidDiagramModal } from "./MermaidDiagramModal";

export const MERMAID_PENDING_LABEL = "Rendering diagram…";

/** Kanagawa Dragon–aligned Mermaid theme (dark base + CSS variables). */
const MERMAID_THEME_VARIABLES = {
  darkMode: "true",
  background: "#1d1c19",
  mainBkg: "#1d1c19",
  secondBkg: "#282727",
  tertiaryBkg: "#393836",
  primaryColor: "#c5c9c5",
  primaryTextColor: "#c5c9c5",
  secondaryColor: "#9e9b93",
  tertiaryColor: "#7a8382",
  lineColor: "#62625a",
  textColor: "#c5c9c5",
  nodeBorder: "#62625a",
  clusterBkg: "#282727",
  titleColor: "#8ba4b0",
  edgeLabelBackground: "#1d1c19",
  actorBorder: "#62625a",
  actorBkg: "#282727",
  actorTextColor: "#c5c9c5",
  signalColor: "#87a987",
  labelBoxBkgColor: "#282727",
  labelBoxBorderColor: "#62625a",
  labelTextColor: "#c5c9c5",
} as const;

let mermaidReady = false;

function ensureMermaid(): typeof mermaid {
  if (!mermaidReady) {
    mermaid.initialize({
      startOnLoad: false,
      theme: "dark",
      securityLevel: "strict",
      themeVariables: MERMAID_THEME_VARIABLES,
      flowchart: {
        htmlLabels: false,
        useMaxWidth: false,
      },
      sequence: {
        useMaxWidth: false,
      },
    });
    mermaidReady = true;
  }
  return mermaid;
}

/** Warm mermaid so the first diagram does not wait on initialization. */
export function preloadMermaid(): void {
  ensureMermaid();
}

export interface MermaidDiagramProps {
  source: string;
  /** When false, show placeholder until the ```mermaid fence is closed in the parent markdown. */
  renderable?: boolean;
}

/** Plain function export so MarkdownMessage can detect and unwrap from CodeBlockPre. */
export function MermaidDiagram({ source, renderable = true }: MermaidDiagramProps) {
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const baseId = useId().replace(/:/g, "");
  const renderGenerationRef = useRef(0);
  const lastRenderedSourceRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);
  const queuedSourceRef = useRef<string | null>(null);

  const renderSource = source.trim();

  useEffect(() => {
    if (!renderable || !renderSource) {
      return;
    }

    if (lastRenderedSourceRef.current === renderSource) {
      return;
    }

    queuedSourceRef.current = renderSource;
    if (inFlightRef.current) {
      return;
    }

    let cancelled = false;
    const cancelSchedule = scheduleIdleTask(() => {
      if (cancelled || inFlightRef.current) {
        return;
      }
      inFlightRef.current = true;

      const runQueue = async () => {
        try {
          const mermaidApi = ensureMermaid();

          while (queuedSourceRef.current) {
            const nextSource = queuedSourceRef.current;
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
        } finally {
          inFlightRef.current = false;
          if (!cancelled && queuedSourceRef.current) {
            inFlightRef.current = true;
            void runQueue();
          }
        }
      };

      void runQueue();
    });

    return () => {
      cancelled = true;
      cancelSchedule();
    };
  }, [renderSource, renderable, baseId]);

  if (!renderable) {
    return (
      <div
        className="mermaid-diagram mermaid-diagram--pending"
        aria-busy="true"
        aria-label={MERMAID_PENDING_LABEL}
      >
        {MERMAID_PENDING_LABEL}
      </div>
    );
  }

  if (failed) {
    return (
      <pre>
        <code className="language-mermaid">{source}</code>
      </pre>
    );
  }

  if (!svg) {
    return (
      <div
        className="mermaid-diagram mermaid-diagram--pending"
        aria-busy="true"
        aria-label={MERMAID_PENDING_LABEL}
      >
        {MERMAID_PENDING_LABEL}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        className="mermaid-diagram"
        onClick={() => setExpanded(true)}
        aria-label="Expand diagram"
        title="Expand diagram"
      >
        <div
          className="mermaid-diagram__canvas"
          // SVG from mermaid.render with securityLevel: "strict"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </button>
      {expanded ? <MermaidDiagramModal svg={svg} onClose={() => setExpanded(false)} /> : null}
    </>
  );
}
