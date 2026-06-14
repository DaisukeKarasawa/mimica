import { useEffect, useId, useRef, useState } from "react";

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

let mermaidInitPromise: Promise<typeof import("mermaid").default> | null = null;

async function loadMermaid(): Promise<typeof import("mermaid").default> {
  if (!mermaidInitPromise) {
    mermaidInitPromise = import("mermaid").then((mod) => {
      mod.default.initialize({
        startOnLoad: false,
        theme: "dark",
        securityLevel: "strict",
        themeVariables: MERMAID_THEME_VARIABLES,
      });
      return mod.default;
    });
  }
  return mermaidInitPromise;
}

export interface MermaidDiagramProps {
  source: string;
  /** When false, show placeholder until the ```mermaid fence is closed in the parent markdown. */
  renderable?: boolean;
}

export function MermaidDiagram({ source, renderable = true }: MermaidDiagramProps) {
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const baseId = useId().replace(/:/g, "");
  const renderGenerationRef = useRef(0);
  const lastRenderedSourceRef = useRef<string | null>(null);

  useEffect(() => {
    if (!renderable) {
      return;
    }

    const trimmed = source.trim();
    if (!trimmed) {
      return;
    }

    if (lastRenderedSourceRef.current === trimmed) {
      return;
    }

    let cancelled = false;
    const generation = ++renderGenerationRef.current;
    setFailed(false);

    void (async () => {
      try {
        const mermaid = await loadMermaid();
        const elementId = `mermaid-${baseId}-${generation}`;
        const { svg: renderedSvg } = await mermaid.render(elementId, trimmed);
        if (cancelled || generation !== renderGenerationRef.current) {
          return;
        }
        lastRenderedSourceRef.current = trimmed;
        setFailed(false);
        setSvg(renderedSvg);
      } catch (error) {
        console.warn("[MermaidDiagram] render failed", error);
        if (cancelled || generation !== renderGenerationRef.current) {
          return;
        }
        setFailed(true);
        setSvg(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [source, renderable, baseId]);

  if (!renderable) {
    return (
      <div className="mermaid-diagram mermaid-diagram--pending" aria-busy="true">
        図を描画中…
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
      <div className="mermaid-diagram mermaid-diagram--pending" aria-busy="true">
        図を描画中…
      </div>
    );
  }

  return (
    <div
      className="mermaid-diagram"
      // SVG from mermaid.render with securityLevel: "strict"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
