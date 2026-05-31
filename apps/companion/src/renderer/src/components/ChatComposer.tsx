import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { AgentMode } from "@mimica/shared";
import { agentModeComposerPlaceholder, cycleAgentMode } from "@mimica/shared";

/** Matches `.composer-input` max-height in chat.css */
const COMPOSER_INPUT_MAX_HEIGHT_PX = 160;

interface ChatComposerProps {
  value: string;
  agentMode: AgentMode;
  characterShortName: string;
  disabled?: boolean;
  streaming?: boolean;
  onChange: (value: string) => void;
  onAgentModeChange: (mode: AgentMode) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function ChatComposer({
  value,
  agentMode,
  characterShortName,
  disabled,
  streaming,
  onChange,
  onAgentModeChange,
  onSubmit,
  onCancel,
}: ChatComposerProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const controlsLocked = disabled || streaming;
  const canSend = !controlsLocked && value.trim().length > 0;

  const syncInputHeight = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;

    const box = el.closest(".composer-box");
    box?.classList.remove("is-multiline");
    el.style.height = "auto";
    const probeHeight = el.scrollHeight;
    const multiline = el.value.includes("\n") || probeHeight > 36;
    box?.classList.toggle("is-multiline", multiline);

    el.style.height = "auto";
    const scrollHeight = el.scrollHeight;
    const height = Math.min(scrollHeight, COMPOSER_INPUT_MAX_HEIGHT_PX);
    el.style.height = `${height}px`;
    el.style.overflowY = scrollHeight > COMPOSER_INPUT_MAX_HEIGHT_PX ? "auto" : "hidden";
  }, []);

  useLayoutEffect(() => {
    syncInputHeight();
  }, [value, syncInputHeight]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => syncInputHeight());
    observer.observe(el);
    return () => observer.disconnect();
  }, [syncInputHeight]);

  const sendButton = streaming ? (
    <button
      type="button"
      className="composer-send composer-stop"
      title="停止"
      aria-label="停止"
      onClick={onCancel}
    >
      <svg className="composer-stop-icon" viewBox="0 0 16 16" aria-hidden>
        <rect x="4" y="4" width="8" height="8" rx="1.25" fill="currentColor" />
      </svg>
    </button>
  ) : (
    <button
      type="button"
      className="composer-send"
      disabled={!canSend}
      title="Shift+Enter で送信"
      aria-label="送信"
      onClick={onSubmit}
    >
      <svg viewBox="0 0 16 16" aria-hidden>
        <path
          d="M8 12V4M8 4L5 7M8 4l3 3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );

  return (
    <div className={`composer-box mode-${agentMode} ${disabled ? "is-disabled" : ""}`}>
      <div className="composer-row">
        <textarea
          ref={inputRef}
          className="composer-input"
          placeholder={agentModeComposerPlaceholder(agentMode, characterShortName)}
          value={value}
          disabled={disabled}
          rows={1}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Tab" && e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
              if (!controlsLocked) {
                e.preventDefault();
                onAgentModeChange(cycleAgentMode(agentMode, -1));
              }
              return;
            }
            if (e.key !== "Enter" || !e.shiftKey) return;
            if (e.nativeEvent.isComposing || e.keyCode === 229) return;
            e.preventDefault();
            if (canSend) onSubmit();
          }}
        />
        <div className="composer-actions">{sendButton}</div>
      </div>
    </div>
  );
}
