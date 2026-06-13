import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";
import { extractCodeBlockText, parseLanguageFromCodeClass } from "../lib/codeBlock";

type CopyState = "idle" | "copied" | "failed";

const COPIED_RESET_MS = 2000;
const FAILED_RESET_MS = 3000;

function isCodeElement(
  child: ReactNode,
): child is ReactElement<{ className?: string; children?: ReactNode }> {
  return isValidElement(child) && child.type === "code";
}

interface CodeBlockPreProps extends HTMLAttributes<HTMLPreElement> {
  children?: ReactNode;
}

export function CodeBlockPre({ children, ...preProps }: CodeBlockPreProps) {
  const preRef = useRef<HTMLPreElement>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [copyState, setCopyState] = useState<CopyState>("idle");

  const codeChild = Children.toArray(children).find(isCodeElement) ?? null;
  const language = parseLanguageFromCodeClass(codeChild?.props.className);
  const initialText = codeChild ? extractCodeBlockText(codeChild) : "";
  const isEmpty = initialText.length === 0;

  const clearResetTimer = useCallback(() => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearResetTimer, [clearResetTimer]);

  const scheduleReset = useCallback(
    (ms: number) => {
      clearResetTimer();
      resetTimerRef.current = setTimeout(() => {
        setCopyState("idle");
        resetTimerRef.current = null;
      }, ms);
    },
    [clearResetTimer],
  );

  const handleCopy = useCallback(async () => {
    const text = preRef.current?.querySelector("code")?.textContent ?? "";
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
      scheduleReset(COPIED_RESET_MS);
    } catch {
      setCopyState("failed");
      scheduleReset(FAILED_RESET_MS);
    }
  }, [scheduleReset]);

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
        >
          {buttonLabel}
        </button>
      </div>
      <pre {...preProps} ref={preRef}>
        {children}
      </pre>
      {copyState === "failed" ? (
        <p className="code-block-copy-status" role="status">
          クリップボードへのコピーに失敗しました
        </p>
      ) : null}
    </div>
  );
}
