import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import {
  extractCodeBlockText,
  parseLanguageFromCodeClass,
  type CodeBlockElement,
} from "../lib/codeBlock";

type CopyState = "idle" | "copied" | "failed";

const COPIED_RESET_MS = 2000;
const FAILED_RESET_MS = 3000;

function isCodeElement(child: ReactNode): child is CodeBlockElement {
  return isValidElement(child) && child.type === "code";
}

interface CodeBlockPreProps extends HTMLAttributes<HTMLPreElement> {
  children?: ReactNode;
}

export function CodeBlockPre({ children, ...preProps }: CodeBlockPreProps) {
  const [copyState, setCopyState] = useState<CopyState>("idle");

  const codeChild = Children.toArray(children).find(isCodeElement) ?? null;
  const language = parseLanguageFromCodeClass(codeChild?.props.className);
  const blockText = extractCodeBlockText(codeChild);
  const isEmpty = blockText.length === 0;

  useEffect(() => {
    if (copyState === "idle") return;
    const ms = copyState === "copied" ? COPIED_RESET_MS : FAILED_RESET_MS;
    const id = setTimeout(() => setCopyState("idle"), ms);
    return () => clearTimeout(id);
  }, [copyState]);

  const handleCopy = useCallback(async () => {
    if (!blockText) return;

    try {
      await navigator.clipboard.writeText(blockText);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }, [blockText]);

  const buttonLabel =
    copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy failed" : "Copy";

  const ariaLabel =
    copyState === "copied"
      ? "コピーしました"
      : copyState === "failed"
        ? "コピーに失敗しました"
        : "コードをコピー";

  return (
    <div className="code-block-shell">
      <div className={`code-block-header${language ? "" : " code-block-header--no-lang"}`}>
        {language ? <span className="code-block-language">{language}</span> : null}
        <button
          type="button"
          className="code-block-copy"
          onClick={() => void handleCopy()}
          disabled={isEmpty}
          aria-label={ariaLabel}
          title={ariaLabel}
          aria-live={copyState === "failed" ? "polite" : undefined}
        >
          {buttonLabel}
        </button>
      </div>
      <pre {...preProps}>{children}</pre>
    </div>
  );
}
