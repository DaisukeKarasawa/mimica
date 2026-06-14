import { useId, useState } from "react";
import { useMermaidSvg } from "../hooks/useMermaidSvg";
import { MermaidDiagramModal } from "./MermaidDiagramModal";

export const MERMAID_PENDING_LABEL = "Rendering diagram…";

export interface MermaidDiagramProps {
  source: string;
  /** When false, show placeholder until the ```mermaid fence is closed in the parent markdown. */
  renderable?: boolean;
}

/** Plain function export so MarkdownMessage can detect and unwrap from CodeBlockPre. */
export function MermaidDiagram({ source, renderable = true }: MermaidDiagramProps) {
  const [expanded, setExpanded] = useState(false);
  const baseId = useId().replace(/:/g, "");
  const { svg, failed } = useMermaidSvg(source, renderable, baseId);

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
