import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { normalizeCollapsedTables } from "../lib/normalizeMarkdown";

interface MarkdownMessageProps {
  content: string;
}

const markdownComponents: Components = {
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
};

export function MarkdownMessage({ content }: MarkdownMessageProps) {
  const normalized = normalizeCollapsedTables(content);

  return (
    <div className="md-preview">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {normalized}
      </ReactMarkdown>
    </div>
  );
}
