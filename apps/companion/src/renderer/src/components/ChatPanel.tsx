import { useState } from "react";
import type { AgentMode, AvatarState, ChatSession } from "@mimica/shared";
import { AGENT_DISPLAY_NAME } from "@mimica/shared";
import { useStickToBottomScroll } from "../hooks/useStickToBottomScroll";
import { useTabPointerReorder } from "../hooks/useTabPointerReorder";
import { ChatComposer } from "./ChatComposer";
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
  avatarState: AvatarState;
  agentMode: AgentMode;
  characterShortName: string;
  onAgentModeChange: (mode: AgentMode) => void;
  chatIconUrl?: string | null;
  onSelectSession: (id: string) => void;
  onCloseTab: (id: string) => void;
  onReorderTab: (draggedId: string, toIndex: number) => void;
  onSelectHistorySession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onSend: (text: string) => void;
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
  avatarState,
  agentMode,
  characterShortName,
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
  const showThinkingIndicator = avatarState === "thinking" && awaitingAssistantReply;
  const { containerRef: messagesRef, scrollToBottom } = useStickToBottomScroll({
    enabled: showChat,
    resetKey: activeSessionId,
    contentVersion: [activeSession?.messages, showThinkingIndicator, isStreaming],
  });

  const handleSubmit = () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    scrollToBottom({ force: true });
    onSend(text);
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
                  タブがありません。⌘T（Ctrl+T）で New Chat
                  を開くか、⌘Y（Ctrl+Y）で履歴を開いてください。
                </p>
              )}
              {activeSession?.messages.map((msg) => {
                if (msg.role === "user") {
                  return (
                    <div key={msg.id} className="msg user">
                      <div className="bubble-shell">
                        <div className="bubble">{msg.content}</div>
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
              <ChatComposer
                value={input}
                agentMode={agentMode}
                characterShortName={characterShortName}
                disabled={!activeSession}
                streaming={isStreaming}
                onChange={setInput}
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
