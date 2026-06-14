import {
  Children,
  useCallback,
  useEffect,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { extractCodeBlockText, isPreCodeChild, parseLanguageFromCodeClass } from "../lib/codeBlock";
import { copyTextToClipboard } from "../lib/copyText";

type CopyState = "idle" | "copied" | "failed";

const COPIED_RESET_MS = 2000;
const FAILED_RESET_MS = 3000;

interface CodeBlockPreProps extends HTMLAttributes<HTMLPreElement> {
  children?: ReactNode;
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <rect
        x="5"
        y="5"
        width="8"
        height="8"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <path
        d="M4 11V4.5A1.5 1.5 0 0 1 5.5 3H11"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M4 8.5 6.75 11.25 12 5.75"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CodeBlockPre({ children, ...preProps }: CodeBlockPreProps) {
  const [copyState, setCopyState] = useState<CopyState>("idle");

  const codeChild = Children.toArray(children).find(isPreCodeChild) ?? null;
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
      await copyTextToClipboard(blockText);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }, [blockText]);

  const ariaLabel =
    copyState === "copied"
      ? "コピーしました"
      : copyState === "failed"
        ? "コピーに失敗しました"
        : "コードをコピー";

  return (
    <div className="code-block-shell">
      {language ? (
        <div className="code-block-header">
          <span className="code-block-language">{language}</span>
        </div>
      ) : null}
      <pre {...preProps}>{children}</pre>
      <button
        type="button"
        className={`code-block-copy${copyState === "copied" ? " is-copied" : ""}${copyState === "failed" ? " is-failed" : ""}`}
        onClick={() => void handleCopy()}
        disabled={isEmpty}
        aria-label={ariaLabel}
        title={ariaLabel}
        aria-live={copyState !== "idle" ? "polite" : undefined}
      >
        {copyState === "copied" ? <CheckIcon /> : <CopyIcon />}
      </button>
    </div>
  );
}
