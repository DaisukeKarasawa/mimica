import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type {
  AgentMode,
  AgentQuestionAnswerPayload,
  ChatAttachment,
  ChatSession,
} from "@mimica/shared";
import type { QueuedAgentSubmit } from "../lib/messageQueue";
import type { EditedFileEntry, RunLogEntry } from "../lib/runLog";
import { AGENT_DISPLAY_NAME, sessionHasPendingQuestion } from "@mimica/shared";
import { shouldShowAssistantPendingIndicator, type SessionRunStatus } from "../lib/sessionRunState";
import { useStickToBottomScroll } from "../hooks/useStickToBottomScroll";
import { useTabPointerReorder } from "../hooks/useTabPointerReorder";
import { ipcErrorMessage } from "../lib/composerError";
import { ChatComposer } from "./ChatComposer";
import { ComposerQueue } from "./ComposerQueue";
import { MessageAttachments } from "./ComposerAttachments";
import { ChatHistoryPanel } from "./ChatHistoryPanel";
import { ChatLogPanel } from "./ChatLogPanel";
import { MarkdownMessage } from "./MarkdownMessage";
import { QuestionCard } from "./QuestionCard";
import { ThinkingIndicator } from "./ThinkingIndicator";

export type ChatPanelMode = "chat" | "history" | "log";

interface ChatPanelProps {
  openSessions: ChatSession[];
  historySessions: ChatSession[];
  activeSessionId: string | null;
  activeSession: ChatSession | null;
  panelMode: ChatPanelMode;
  tabsBarVisible: boolean;
  isStreaming: boolean;
  activeSessionRunId?: string | null;
  runLogEntries?: RunLogEntry[];
  editedFiles?: EditedFileEntry[];
  activeSessionRunStatus?: SessionRunStatus;
  queuedItems?: QueuedAgentSubmit[];
  submitError?: string | null;
  onClearSubmitError?: () => void;
  agentMode: AgentMode;
  characterShortName: string;
  workspacePath: string | null;
  onAgentModeChange: (mode: AgentMode) => void;
  chatIconUrl?: string | null;
  onSelectSession: (id: string) => void;
  onCloseTab: (id: string) => void;
  onReorderTab: (draggedId: string, toIndex: number) => void;
  onSelectHistorySession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onSend: (text: string, attachments?: ChatAttachment[]) => void | Promise<void>;
  onCancel: () => void;
  onQuestionAnswer: (runId: string, payload: AgentQuestionAnswerPayload) => Promise<void>;
  onQuestionDismiss: (runId: string, questionPromptId: string) => Promise<void>;
  isSessionRunActive?: (sessionId: string) => boolean;
}

export function ChatPanel({
  openSessions,
  historySessions,
  activeSessionId,
  activeSession,
  panelMode,
  tabsBarVisible,
  isStreaming,
  activeSessionRunId = null,
  runLogEntries = [],
  editedFiles = [],
  activeSessionRunStatus = "idle",
  queuedItems = [],
  submitError = null,
  onClearSubmitError,
  agentMode,
  characterShortName,
  workspacePath,
  onAgentModeChange,
  chatIconUrl,
  onSelectSession,
  onCloseTab,
  onReorderTab,
  onSelectHistorySession,
  onDeleteSession,
  onSend,
  onCancel,
  onQuestionAnswer,
  onQuestionDismiss,
  isSessionRunActive,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [composerBannerError, setComposerBannerError] = useState<string | null>(null);
  const prevSessionIdRef = useRef(activeSessionId);
  const hasPendingQuestion =
    activeSession != null ? sessionHasPendingQuestion(activeSession) : false;

  useEffect(() => {
    onClearSubmitError?.();
  }, [activeSessionId, onClearSubmitError]);

  useLayoutEffect(() => {
    const previousSessionId = prevSessionIdRef.current;
    if (previousSessionId && previousSessionId !== activeSessionId) {
      setAttachments((prev) => {
        if (prev.length > 0) {
          void window.mimica.discardImageAttachments(previousSessionId, prev);
        }
        return [];
      });
      setComposerBannerError(null);
    } else if (previousSessionId !== activeSessionId) {
      setAttachments([]);
      setComposerBannerError(null);
    }
    prevSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);
  const tabsReorderable = openSessions.length > 1;
  const tabIds = openSessions.map((session) => session.id);
  const { draggingId, dropTargetIndex, registerTabRef, tabPointerHandlers, handleTabClick } =
    useTabPointerReorder({
      tabIds,
      enabled: tabsReorderable,
      onReorderTab,
    });

  const showChat = panelMode === "chat";
  const showHistory = panelMode === "history";
  const showLog = panelMode === "log";
  const showAssistantPendingIndicator = shouldShowAssistantPendingIndicator(
    activeSessionRunStatus,
    activeSession,
    activeSessionRunId,
  );
  const { containerRef: messagesRef, scrollToBottom } = useStickToBottomScroll({
    enabled: showChat,
    resetKey: activeSessionId,
    contentVersion: {
      messageCount: activeSession?.messages.length ?? 0,
      trailingContentLength: activeSession?.messages.at(-1)?.content.length ?? 0,
      showThinkingIndicator: showAssistantPendingIndicator,
      isStreaming,
    },
  });

  const handleSubmit = async () => {
    const text = input.trim();
    if ((!text && attachments.length === 0) || !workspacePath) return;
    const outgoing = attachments;
    scrollToBottom({ force: true });
    try {
      await onSend(text, outgoing.length > 0 ? outgoing : undefined);
      setInput("");
      setAttachments([]);
      setComposerBannerError(null);
    } catch (error) {
      setComposerBannerError(ipcErrorMessage(error));
    }
  };

  return (
    <aside className="chat" aria-label="チャットパネル">
      <div className="chat-head">
        <div className="chat-title">
          <h2>{AGENT_DISPLAY_NAME}</h2>
        </div>
        {tabsBarVisible && showChat ? (
          <div className={`tabs-bar ${draggingId ? "is-reordering" : ""}`}>
            <div className="tabs-scroll">
              {openSessions.map((session, index) => (
                <div
                  key={session.id}
                  ref={registerTabRef(session.id)}
                  className={[
                    "tab-wrap",
                    session.id === activeSessionId && showChat ? "active" : "",
                    draggingId === session.id ? "dragging" : "",
                    dropTargetIndex === index ? "drop-before" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <button
                    type="button"
                    className={["tab", isSessionRunActive?.(session.id) ? "tab--running" : ""]
                      .filter(Boolean)
                      .join(" ")}
                    onPointerDown={(event) => tabPointerHandlers.onPointerDown(event, session.id)}
                    onPointerMove={tabPointerHandlers.onPointerMove}
                    onPointerUp={tabPointerHandlers.onPointerUp}
                    onPointerCancel={tabPointerHandlers.onPointerCancel}
                    onClick={(event) => handleTabClick(event, session.id, onSelectSession)}
                    title={session.title}
                  >
                    <span className="tab-label">{session.title}</span>
                    {isSessionRunActive?.(session.id) ? (
                      <span className="tab-run-dot" aria-hidden="true" />
                    ) : null}
                  </button>
                  {session.id === activeSessionId && showChat ? (
                    <button
                      type="button"
                      className="tab-close"
                      aria-label={`${session.title} のタブを閉じる`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onCloseTab(session.id);
                      }}
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="chat-body">
        {showChat ? (
          <>
            <div className="messages" ref={messagesRef}>
              {!activeSession && (
                <p className="chat-empty">
                  {workspacePath ? (
                    <>
                      タブがありません。Mimica ウィンドウを選択した状態で ⌘T（Windows は Ctrl+T）で
                      New Chat を開くか、⌘Y（Ctrl+Y）で履歴、⌘J（Ctrl+J）でログを開いてください。
                    </>
                  ) : (
                    <>
                      Cursor でフォルダを開き、コマンドパレットから「Mimica: Open
                      Companion」を実行してください。接続後、最初のチャットが自動で開きます。
                    </>
                  )}
                </p>
              )}
              {activeSession?.messages.map((msg) => {
                if (msg.role === "user") {
                  return (
                    <div key={msg.id} className="msg user">
                      <div className="bubble-shell">
                        <div className="bubble">
                          {msg.content ? <p className="message-text">{msg.content}</p> : null}
                          {activeSession && msg.attachments?.length ? (
                            <MessageAttachments
                              sessionId={activeSession.id}
                              attachments={msg.attachments}
                            />
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                }

                if (!msg.content.trim() && !msg.agentQuestion) return null;
                if (
                  msg.agentRunId &&
                  msg.agentRunId === activeSessionRunId &&
                  isStreaming &&
                  !msg.agentQuestion &&
                  !msg.content.trim()
                ) {
                  return null;
                }

                return (
                  <div key={msg.id} className="msg agent">
                    {chatIconUrl ? (
                      <img src={chatIconUrl} alt="" className="agent-icon" title="調月リオ" />
                    ) : (
                      <div className="agent-icon" title="キャラクターアイコン（未配置）" />
                    )}
                    <div className="bubble-shell">
                      <div className="bubble">
                        {msg.content.trim() ? <MarkdownMessage content={msg.content} /> : null}
                        {msg.agentQuestion ? (
                          <QuestionCard
                            key={msg.agentQuestion.id}
                            question={msg.agentQuestion}
                            disabled={
                              !msg.agentRunId ||
                              msg.agentQuestion.status !== "pending" ||
                              isStreaming
                            }
                            onSubmit={(payload) => void onQuestionAnswer(msg.agentRunId!, payload)}
                            onDismiss={() =>
                              void onQuestionDismiss(msg.agentRunId!, msg.agentQuestion!.id)
                            }
                          />
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
              {showAssistantPendingIndicator ? (
                <ThinkingIndicator chatIconUrl={chatIconUrl} />
              ) : null}
            </div>

            <div className="composer">
              <ComposerQueue items={queuedItems} />
              {submitError ? (
                <p className="composer-submit-error" role="alert">
                  {submitError}
                </p>
              ) : null}
              {composerBannerError ? (
                <p className="composer-banner-error" role="alert">
                  {composerBannerError}
                </p>
              ) : null}
              <ChatComposer
                value={input}
                agentMode={agentMode}
                characterShortName={characterShortName}
                workspacePath={workspacePath}
                sessionId={activeSession?.id ?? null}
                attachments={attachments}
                disabled={!workspacePath || hasPendingQuestion}
                streaming={isStreaming}
                onChange={setInput}
                onAttachmentsChange={setAttachments}
                onComposerError={setComposerBannerError}
                onAgentModeChange={onAgentModeChange}
                onSubmit={() => void handleSubmit()}
                onCancel={onCancel}
              />
            </div>
          </>
        ) : showHistory ? (
          <ChatHistoryPanel
            sessions={historySessions}
            activeSessionId={activeSessionId}
            onSelect={onSelectHistorySession}
            onDelete={onDeleteSession}
          />
        ) : (
          <ChatLogPanel
            entries={runLogEntries}
            editedFiles={editedFiles}
            activeSessionId={activeSessionId}
          />
        )}
      </div>
    </aside>
  );
}
