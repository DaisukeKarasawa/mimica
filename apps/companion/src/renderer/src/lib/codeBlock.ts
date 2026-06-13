/** Language id from react-markdown / highlight.js class, e.g. `language-ts` → `ts`. */
export function parseLanguageFromCodeClass(className?: string): string | null {
  if (!className) return null;
  const match = /\blanguage-([\w+-]+)\b/.exec(className);
  return match?.[1] ?? null;
}

/** Plain text from a fenced code block's inner `code` element props. */
export function extractCodeBlockText(children: unknown): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) {
    return children.map((child) => extractCodeBlockText(child)).join("");
  }
  if (children && typeof children === "object" && "props" in children) {
    const props = (children as { props?: { children?: unknown } }).props;
    return extractCodeBlockText(props?.children);
  }
  return "";
}
