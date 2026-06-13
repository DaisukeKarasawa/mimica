import { useCallback, useEffect, useLayoutEffect, useRef, type SetStateAction } from "react";
import type { AgentMode, ChatAttachment, AtMenuItem } from "@mimica/shared";
import { agentModeComposerPlaceholder, cycleAgentMode } from "@mimica/shared";
import { ComposerAttachments } from "./ComposerAttachments";
import { SlashCommandMenu, useSlashMenuSections, useSlashMenuState } from "./SlashCommandMenu";
import { AtMentionMenu, replaceAtMenuSelection, useAtMenuState } from "./AtMentionMenu";
import { handleComposerMenuKeyDown } from "./useComposerMenuKeyboard";
import { fileToBase64 } from "../utils/fileToBase64";
import { formatClientPersonaError, ipcErrorMessage } from "../lib/composerError";

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
  onAttachmentsChange: (attachments: SetStateAction<ChatAttachment[]>) => void;
  onAgentModeChange: (mode: AgentMode) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onComposerError?: (message: string) => void;
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
  onComposerError,
}: ChatComposerProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sections = useSlashMenuSections(workspacePath, agentMode);
  const inputLocked = Boolean(disabled);
  const canSend = !inputLocked && (value.trim().length > 0 || attachments.length > 0);
  const slashMenu = useSlashMenuState(value, sections, inputLocked);
  const atMenu = useAtMenuState(value, workspacePath, sessionId, inputLocked, slashMenu.open);

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

  const reportComposerError = useCallback(
    (error: unknown) => {
      onComposerError?.(ipcErrorMessage(error));
    },
    [onComposerError],
  );

  const pickImages = useCallback(async () => {
    if (!sessionId) {
      onComposerError?.(await formatClientPersonaError("session"));
      return;
    }
    try {
      const picked = await window.mimica.pickImageAttachments(sessionId);
      if (picked.length > 0) {
        onAttachmentsChange((prev) => [...prev, ...picked]);
        onChange("");
      }
    } catch (error) {
      reportComposerError(error);
    }
  }, [onAttachmentsChange, onChange, onComposerError, reportComposerError, sessionId]);

  const pasteImage = useCallback(
    async (file: File) => {
      if (!sessionId) {
        onComposerError?.(await formatClientPersonaError("session"));
        return;
      }
      try {
        const data = await fileToBase64(file);
        const saved = await window.mimica.pasteImageAttachment(sessionId, {
          mimeType: file.type,
          data,
        });
        onAttachmentsChange((prev) => [...prev, saved]);
      } catch (error) {
        reportComposerError(error);
      }
    },
    [onAttachmentsChange, onComposerError, reportComposerError, sessionId],
  );

  const selectAtItem = useCallback(
    (item: AtMenuItem) => {
      onChange(replaceAtMenuSelection(value, item));
      queueMicrotask(() => inputRef.current?.focus());
    },
    [onChange, value],
  );

  const selectSlashItem = useCallback(
    async (name: string, kind: string) => {
      if (kind === "image" && name === "attach") {
        await pickImages();
        return;
      }
      onChange(`/${name} `);
      queueMicrotask(() => inputRef.current?.focus());
    },
    [onChange, pickImages],
  );

  const sendButton = (
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

  const stopButton = streaming ? (
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
  ) : null;

  return (
    <div className={`composer-box mode-${agentMode} ${disabled ? "is-disabled" : ""}`}>
      <AtMentionMenu
        open={atMenu.open}
        workspaceLinked={atMenu.workspaceLinked}
        sections={atMenu.sections}
        filteredItems={atMenu.filteredItems}
        highlightedIndex={atMenu.highlightedIndex}
        onHighlightChange={atMenu.setHighlightedIndex}
        onSelect={selectAtItem}
      />
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
          disabled={inputLocked}
          onRemove={(attachmentId) => {
            const removed = attachments.find((item) => item.id === attachmentId);
            onAttachmentsChange((prev) => prev.filter((item) => item.id !== attachmentId));
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
            if (inputLocked) return;
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
            if (
              handleComposerMenuKeyDown(e, {
                open: slashMenu.open,
                filteredItems: slashMenu.filteredItems,
                highlightedIndex: slashMenu.highlightedIndex,
                setHighlightedIndex: slashMenu.setHighlightedIndex,
                onSelect: (item) => void selectSlashItem(item.name, item.kind),
                onEscape: () => onChange(""),
              })
            ) {
              return;
            }

            if (
              handleComposerMenuKeyDown(e, {
                open: atMenu.open,
                filteredItems: atMenu.filteredItems,
                highlightedIndex: atMenu.highlightedIndex,
                setHighlightedIndex: atMenu.setHighlightedIndex,
                onSelect: selectAtItem,
                onEscape: () => onChange(value.replace(/@([^\s@]*)$/, "")),
              })
            ) {
              return;
            }

            if (e.key === "Tab" && e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
              if (!inputLocked) {
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
        <div className="composer-actions">
          {stopButton}
          {sendButton}
        </div>
      </div>
    </div>
  );
}
