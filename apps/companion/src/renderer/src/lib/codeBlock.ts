import type { ReactElement, ReactNode } from "react";

/** Inner `code` element from react-markdown fenced blocks. */
export type CodeBlockElement = ReactElement<{ className?: string; children?: ReactNode }>;

/** Language id from react-markdown / highlight.js class, e.g. `language-ts` → `ts`. */
export function parseLanguageFromCodeClass(className?: string): string | null {
  if (!className) return null;
  const match = /\blanguage-([\w+-]+)\b/.exec(className);
  return match?.[1] ?? null;
}

/** Plain text from a fenced block's inner `code` element. */
export function extractCodeBlockText(codeElement: CodeBlockElement | null | undefined): string {
  if (!codeElement) return "";
  return flattenMarkdownChildren(codeElement.props.children);
}

function flattenMarkdownChildren(children: ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) {
    return children.map((child) => flattenMarkdownChildren(child)).join("");
  }
  return "";
}
