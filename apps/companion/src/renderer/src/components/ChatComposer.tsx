import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { AgentMode, ChatAttachment } from "@mimica/shared";
import { agentModeComposerPlaceholder, cycleAgentMode } from "@mimica/shared";
import { ComposerAttachments } from "./ComposerAttachments";
import { SlashCommandMenu, useSlashMenuSections, useSlashMenuState } from "./SlashCommandMenu";
import { fileToBase64 } from "../utils/fileToBase64";

/** Matches `.composer-input` max-height in chat.css */
const COMPOSER_INPUT_MAX_HEIGHT_PX = 160;

interface ChatComposerProps {
  value: string;
  agentMode: AgentMode;
  characterShortName: string;
  workspacePath: string | null;
  sessionId: string | null;
  attachments: ChatAttachment[];
  disabled?: boolean;
  streaming?: boolean;
  onChange: (value: string) => void;
  onAttachmentsChange: (attachments: ChatAttachment[]) => void;
  onAgentModeChange: (mode: AgentMode) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onAttachmentError?: (message: string) => void;
}

export function ChatComposer({
  value,
  agentMode,
  characterShortName,
  workspacePath,
  sessionId,
  attachments,
  disabled,
  streaming,
  onChange,
  onAttachmentsChange,
  onAgentModeChange,
  onSubmit,
  onCancel,
  onAttachmentError,
}: ChatComposerProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sections = useSlashMenuSections(workspacePath, agentMode);
  const controlsLocked = disabled || streaming;
  const canSend = !controlsLocked && (value.trim().length > 0 || attachments.length > 0);
  const slashMenu = useSlashMenuState(value, sections, controlsLocked);

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

  const reportAttachmentError = useCallback(
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      onAttachmentError?.(message);
    },
    [onAttachmentError],
  );

  const pickImages = useCallback(async () => {
    if (!sessionId) {
      onAttachmentError?.("画像を添付するにはチャットセッションが必要です");
      return;
    }
    try {
      const picked = await window.mimica.pickImageAttachments(sessionId, attachments.length);
      if (picked.length > 0) {
        onAttachmentsChange([...attachments, ...picked]);
        onChange("");
      }
    } catch (error) {
      reportAttachmentError(error);
    }
  }, [
    attachments,
    onAttachmentError,
    onAttachmentsChange,
    onChange,
    reportAttachmentError,
    sessionId,
  ]);

  const pasteImage = useCallback(
    async (file: File) => {
      if (!sessionId) {
        onAttachmentError?.("画像を添付するにはチャットセッションが必要です");
        return;
      }
      try {
        const data = await fileToBase64(file);
        const saved = await window.mimica.pasteImageAttachment(sessionId, attachments.length, {
          mimeType: file.type,
          data,
        });
        onAttachmentsChange([...attachments, saved]);
      } catch (error) {
        reportAttachmentError(error);
      }
    },
    [attachments, onAttachmentError, onAttachmentsChange, reportAttachmentError, sessionId],
  );

  const selectSlashItem = useCallback(
    async (name: string, kind: string) => {
      if (kind === "image") {
        await pickImages();
        return;
      }
      onChange(`/${name} `);
      queueMicrotask(() => inputRef.current?.focus());
    },
    [onChange, pickImages],
  );

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
      <SlashCommandMenu
        open={slashMenu.open}
        filteredSections={slashMenu.filteredSections}
        filteredItems={slashMenu.filteredItems}
        highlightedIndex={slashMenu.highlightedIndex}
        onHighlightChange={slashMenu.setHighlightedIndex}
        onSelect={(item) => void selectSlashItem(item.name, item.kind)}
      />
      {sessionId ? (
        <ComposerAttachments
          sessionId={sessionId}
          attachments={attachments}
          disabled={controlsLocked}
          onRemove={(attachmentId) => {
            const removed = attachments.find((item) => item.id === attachmentId);
            onAttachmentsChange(attachments.filter((item) => item.id !== attachmentId));
            if (sessionId && removed) {
              void window.mimica.discardImageAttachment(sessionId, removed);
            }
          }}
        />
      ) : null}
      <div className="composer-row">
        <textarea
          ref={inputRef}
          className="composer-input"
          placeholder={agentModeComposerPlaceholder(agentMode, characterShortName)}
          value={value}
          disabled={disabled}
          rows={1}
          onChange={(e) => onChange(e.target.value)}
          onPaste={(event) => {
            if (controlsLocked) return;
            const items = event.clipboardData?.items;
            if (!items) return;
            for (const item of items) {
              if (!item.type.startsWith("image/")) continue;
              const file = item.getAsFile();
              if (!file) continue;
              event.preventDefault();
              void pasteImage(file);
              return;
            }
          }}
          onKeyDown={(e) => {
            if (slashMenu.open && slashMenu.filteredItems.length > 0) {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                slashMenu.setHighlightedIndex(
                  (index) => (index + 1) % slashMenu.filteredItems.length,
                );
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                slashMenu.setHighlightedIndex(
                  (index) =>
                    (index - 1 + slashMenu.filteredItems.length) % slashMenu.filteredItems.length,
                );
                return;
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                const selected = slashMenu.filteredItems[slashMenu.highlightedIndex];
                if (selected) void selectSlashItem(selected.name, selected.kind);
                return;
              }
              if (e.key === "Escape") {
                e.preventDefault();
                onChange("");
                return;
              }
            }

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
