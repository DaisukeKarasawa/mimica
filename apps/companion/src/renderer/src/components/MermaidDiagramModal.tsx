import { useCallback, useEffect } from "react";
import { createPortal } from "react-dom";

interface MermaidDiagramModalProps {
  svg: string;
  onClose: () => void;
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M4.5 4.5 11.5 11.5M11.5 4.5 4.5 11.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MermaidDiagramModal({ svg, onClose }: MermaidDiagramModalProps) {
  const handleBackdropClick = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="mermaid-diagram-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Mermaid diagram"
    >
      <button
        type="button"
        className="mermaid-diagram-modal__backdrop"
        onClick={handleBackdropClick}
        aria-label="Close diagram"
      />
      <button
        type="button"
        className="mermaid-diagram-modal__close"
        onClick={onClose}
        aria-label="Close diagram"
        title="Close diagram"
      >
        <CloseIcon />
      </button>
      <div
        className="mermaid-diagram-modal__viewport"
        // SVG from mermaid.render with securityLevel: "strict"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>,
    document.body,
  );
}
