import { Children, isValidElement, useMemo, useRef, type ReactNode } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { isMermaidBlockComplete } from "../lib/mermaidFence";
import { normalizeCollapsedTables } from "../lib/normalizeMarkdown";
import { CodeBlockPre } from "./CodeBlockPre";
import { MermaidDiagram } from "./MermaidDiagram";

interface MarkdownMessageProps {
  content: string;
}

function extractCodeText(children: ReactNode): string {
  if (typeof children === "string") {
    return children.replace(/\n$/, "");
  }
  if (Array.isArray(children)) {
    return children
      .map((child) => (typeof child === "string" ? child : ""))
      .join("")
      .replace(/\n$/, "");
  }
  return String(children).replace(/\n$/, "");
}

export function MarkdownMessage({ content }: MarkdownMessageProps) {
  const normalized = normalizeCollapsedTables(content);
  const contentRef = useRef(normalized);
  contentRef.current = normalized;
  const mermaidBlockIndexRef = useRef(0);

  const components = useMemo<Components>(
    () => ({
      pre: function MarkdownPre({ children, ...props }) {
        const child = Children.toArray(children)[0];
        if (isValidElement(child) && child.type === MermaidDiagram) {
          return child;
        }
        return <CodeBlockPre {...props}>{children}</CodeBlockPre>;
      },
      table: function MarkdownTable({ children }) {
        return (
          <div className="md-table-scroll">
            <table>{children}</table>
          </div>
        );
      },
      a: function MarkdownAnchor({ href, children }) {
        return (
          <a
            href={href}
            rel="noopener noreferrer"
            target="_blank"
            onClick={(event) => {
              event.preventDefault();
              if (href) void window.mimica.openExternal(href);
            }}
          >
            {children}
          </a>
        );
      },
      code: function MarkdownCode({ className, children, ...props }) {
        const language = /language-(\S+)/.exec(className ?? "")?.[1];
        if (language === "mermaid") {
          const blockIndex = mermaidBlockIndexRef.current;
          mermaidBlockIndexRef.current += 1;
          const source = extractCodeText(children);
          const renderable = isMermaidBlockComplete(contentRef.current, blockIndex);
          return <MermaidDiagram source={source} renderable={renderable} />;
        }

        const isBlock = Boolean(className);
        if (isBlock) {
          return (
            <code className={className} {...props}>
              {children}
            </code>
          );
        }

        return (
          <code className={className} {...props}>
            {children}
          </code>
        );
      },
    }),
    [],
  );

  mermaidBlockIndexRef.current = 0;

  return (
    <div className="md-preview">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {normalized}
      </ReactMarkdown>
    </div>
  );
}
