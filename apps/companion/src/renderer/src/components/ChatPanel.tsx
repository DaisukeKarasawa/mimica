import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { AgentMode, AvatarState, ChatAttachment, ChatSession } from "@mimica/shared";
import { AGENT_DISPLAY_NAME } from "@mimica/shared";
import type { SessionRunStatus } from "../lib/sessionRunState";
import { useStickToBottomScroll } from "../hooks/useStickToBottomScroll";
import { useTabPointerReorder } from "../hooks/useTabPointerReorder";
import { ChatComposer } from "./ChatComposer";
import { MessageAttachments } from "./ComposerAttachments";
import { ChatHistoryPanel } from "./ChatHistoryPanel";
import { MarkdownMessage } from "./MarkdownMessage";
import { ThinkingIndicator } from "./ThinkingIndicator";

export type ChatPanelMode = "chat" | "history";

interface ChatPanelProps {
  openSessions: ChatSession[];
  historySessions: ChatSession[];
  activeSessionId: string | null;
  activeSession: ChatSession | null;
  panelMode: ChatPanelMode;
  tabsBarVisible: boolean;
  isStreaming: boolean;
  activeSessionRunStatus?: SessionRunStatus;
  queuedCount?: number;
  submitError?: string | null;
  onClearSubmitError?: () => void;
  avatarState: AvatarState;
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
  onSend: (text: string, attachments?: ChatAttachment[]) => void;
  onCancel: () => void;
}

export function ChatPanel({
  openSessions,
  historySessions,
  activeSessionId,
  activeSession,
  panelMode,
  tabsBarVisible,
  isStreaming,
  activeSessionRunStatus = "idle",
  queuedCount = 0,
  submitError = null,
  onClearSubmitError,
  avatarState,
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
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const prevSessionIdRef = useRef(activeSessionId);

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
      setAttachmentError(null);
    } else if (previousSessionId !== activeSessionId) {
      setAttachments([]);
      setAttachmentError(null);
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
  const lastMessage = activeSession?.messages.at(-1);
  const awaitingAssistantReply =
    lastMessage?.role === "user" ||
    (lastMessage?.role === "assistant" && !lastMessage.content.trim());
  const showThinkingIndicator = activeSessionRunStatus === "thinking" && awaitingAssistantReply;
  const { containerRef: messagesRef, scrollToBottom } = useStickToBottomScroll({
    enabled: showChat,
    resetKey: activeSessionId,
    contentVersion: {
      messageCount: activeSession?.messages.length ?? 0,
      trailingContentLength: activeSession?.messages.at(-1)?.content.length ?? 0,
      showThinkingIndicator,
      isStreaming,
    },
  });

  const handleSubmit = () => {
    const text = input.trim();
    if ((!text && attachments.length === 0) || !workspacePath) return;
    const outgoing = attachments;
    setInput("");
    setAttachments([]);
    setAttachmentError(null);
    scrollToBottom({ force: true });
    onSend(text, outgoing.length > 0 ? outgoing : undefined);
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
                    className="tab"
                    onPointerDown={(event) => tabPointerHandlers.onPointerDown(event, session.id)}
                    onPointerMove={tabPointerHandlers.onPointerMove}
                    onPointerUp={tabPointerHandlers.onPointerUp}
                    onPointerCancel={tabPointerHandlers.onPointerCancel}
                    onClick={(event) => handleTabClick(event, session.id, onSelectSession)}
                    title={session.title}
                  >
                    {session.title}
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
                      New Chat を開くか、⌘Y（Ctrl+Y）で履歴を開いてください。
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

                if (!msg.content.trim()) return null;

                return (
                  <div key={msg.id} className="msg agent">
                    {chatIconUrl ? (
                      <img src={chatIconUrl} alt="" className="agent-icon" title="調月リオ" />
                    ) : (
                      <div className="agent-icon" title="キャラクターアイコン（未配置）" />
                    )}
                    <div className="bubble-shell">
                      <div className="bubble">
                        <MarkdownMessage content={msg.content} />
                      </div>
                    </div>
                  </div>
                );
              })}
              {showThinkingIndicator && <ThinkingIndicator chatIconUrl={chatIconUrl} />}
            </div>

            <div className="composer">
              {queuedCount > 0 ? (
                <p className="composer-queue-badge" aria-live="polite">
                  キュー {queuedCount} 件
                </p>
              ) : null}
              {submitError ? (
                <p className="composer-submit-error" role="alert">
                  {submitError}
                </p>
              ) : null}
              {attachmentError ? (
                <p className="composer-attachment-error" role="alert">
                  {attachmentError}
                </p>
              ) : null}
              <ChatComposer
                value={input}
                agentMode={agentMode}
                characterShortName={characterShortName}
                workspacePath={workspacePath}
                sessionId={activeSession?.id ?? null}
                attachments={attachments}
                disabled={!workspacePath}
                streaming={isStreaming}
                onChange={setInput}
                onAttachmentsChange={setAttachments}
                onAttachmentError={setAttachmentError}
                onAgentModeChange={onAgentModeChange}
                onSubmit={handleSubmit}
                onCancel={onCancel}
              />
            </div>
          </>
        ) : (
          <ChatHistoryPanel
            sessions={historySessions}
            activeSessionId={activeSessionId}
            onSelect={onSelectHistorySession}
            onDelete={onDeleteSession}
          />
        )}
      </div>
    </aside>
  );
}
