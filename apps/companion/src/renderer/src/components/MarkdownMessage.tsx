import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { normalizeCollapsedTables } from "../lib/normalizeMarkdown";

interface MarkdownMessageProps {
  content: string;
}

export function MarkdownMessage({ content }: MarkdownMessageProps) {
  const normalized = normalizeCollapsedTables(content);

  return (
    <div className="md-preview">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{normalized}</ReactMarkdown>
    </div>
  );
}
