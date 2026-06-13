import { isValidElement, type ReactNode } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { isMermaidBlockComplete } from "../lib/mermaidFence";
import { normalizeCollapsedTables } from "../lib/normalizeMarkdown";
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

function createMarkdownComponents(content: string): Components {
  let mermaidBlockIndex = 0;

  return {
    a: ({ href, children }) => (
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
    ),
    pre: ({ children, ...props }) => {
      if (isValidElement(children) && children.type === MermaidDiagram) {
        return children;
      }
      return <pre {...props}>{children}</pre>;
    },
    code: ({ className, children, ...props }) => {
      const language = /language-(\S+)/.exec(className ?? "")?.[1];
      if (language === "mermaid") {
        const blockIndex = mermaidBlockIndex;
        mermaidBlockIndex += 1;
        const source = extractCodeText(children);
        const renderable = isMermaidBlockComplete(content, blockIndex);
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
  };
}

export function MarkdownMessage({ content }: MarkdownMessageProps) {
  const normalized = normalizeCollapsedTables(content);
  const components = createMarkdownComponents(normalized);

  return (
    <div className="md-preview">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {normalized}
      </ReactMarkdown>
    </div>
  );
}
