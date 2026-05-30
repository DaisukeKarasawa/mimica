import { useState } from "react";
import type { AvatarState, ChatSession, EditorContext } from "@mimica/shared";
import { AGENT_DISPLAY_NAME } from "@mimica/shared";
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
  editorContext: EditorContext | null;
  isStreaming: boolean;
  avatarState: AvatarState;
  chatIconUrl?: string | null;
  onSelectSession: (id: string) => void;
  onCloseTab: (id: string) => void;
  onShowHistory: () => void;
  onSelectHistorySession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onNewSession: () => void;
  onSend: (text: string) => void;
  onCancel: () => void;
}

function basename(path?: string): string {
  if (!path) return "—";
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] ?? path;
}

export function ChatPanel({
  openSessions,
  historySessions,
  activeSessionId,
  activeSession,
  panelMode,
  editorContext,
  isStreaming,
  avatarState,
  chatIconUrl,
  onSelectSession,
  onCloseTab,
  onShowHistory,
  onSelectHistorySession,
  onDeleteSession,
  onNewSession,
  onSend,
  onCancel,
}: ChatPanelProps) {
  const [input, setInput] = useState("");

  const handleSubmit = () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    onSend(text);
  };

  const showChat = panelMode === "chat";
  const lastMessage = activeSession?.messages.at(-1);
  const awaitingAssistantReply =
    lastMessage?.role === "user" ||
    (lastMessage?.role === "assistant" && !lastMessage.content.trim());
  const showThinkingIndicator = avatarState === "thinking" && awaitingAssistantReply;

  return (
    <aside className="chat" aria-label="チャットパネル">
      <div className="chat-head">
        <div className="chat-title">
          <h2>Agent チャット</h2>
          <span className="chat-shortcuts-hint" title="タブ操作ショートカット">
            {typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
              ? "⌘T · ⌘W · ⌃Tab · ⌘⌥←→"
              : "Ctrl+T · Ctrl+W · Ctrl+Tab"}
          </span>
        </div>
        <div className="tabs-bar">
          <div className="tabs-scroll">
            {openSessions.map((session) => (
              <div
                key={session.id}
                className={`tab-wrap ${session.id === activeSessionId && showChat ? "active" : ""}`}
              >
                <button
                  type="button"
                  className="tab"
                  onClick={() => onSelectSession(session.id)}
                  title={session.title}
                >
                  {session.title}
                </button>
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
              </div>
            ))}
            <button
              type="button"
              className={`tab tab-history ${!showChat ? "active" : ""}`}
              onClick={onShowHistory}
            >
              履歴
            </button>
          </div>
          <button
            type="button"
            className="tab-new"
            onClick={onNewSession}
            aria-label="新規チャット"
            title="新規チャット"
          >
            +
          </button>
        </div>
      </div>

      <div className="chat-body">
        {showChat ? (
          <>
            <div className="context">
              <div className="chip">Workspace: {basename(editorContext?.workspacePath) ?? "—"}</div>
              <div className="chip">Current: {basename(editorContext?.currentFilePath) ?? "—"}</div>
              <div className="chip">
                Selection:{" "}
                {editorContext?.selectedText
                  ? `${(editorContext.selectionEndLine ?? 0) - (editorContext.selectionStartLine ?? 0) + 1} lines`
                  : "—"}
              </div>
            </div>

            <div className="messages">
              {!activeSession && (
                <p className="chat-empty">
                  タブがありません。「+」で新規チャットを開くか、「履歴」からセッションを選んでください。
                </p>
              )}
              {activeSession?.messages.map((msg) =>
                msg.role === "user" ? (
                  <div key={msg.id} className="msg user">
                    <div className="bubble">{msg.content}</div>
                  </div>
                ) : (
                  <div key={msg.id} className="msg agent">
                    {chatIconUrl ? (
                      <img src={chatIconUrl} alt="" className="agent-icon" title="調月リオ" />
                    ) : (
                      <div className="agent-icon" title="キャラクターアイコン（未配置）" />
                    )}
                    <div className="bubble">
                      <div className="agent-name-row">
                        <span className="meta">
                          {AGENT_DISPLAY_NAME} · {msg.role === "assistant" ? avatarState : "system"}
                        </span>
                      </div>
                      <MarkdownMessage content={msg.content} />
                      {msg.toolCalls?.map((tool) => (
                        <div key={tool.id} className="tool-card">
                          tool: {tool.name}
                          {tool.detail ? ` · ${tool.detail}` : ""}
                        </div>
                      ))}
                    </div>
                  </div>
                ),
              )}
              {showThinkingIndicator && <ThinkingIndicator chatIconUrl={chatIconUrl} />}
            </div>

            <div className="composer">
              {isStreaming && (
                <div className="runbar">
                  <span>Agent 応答中… キャラクター状態: {avatarState}</span>
                  <button type="button" className="cancel" onClick={onCancel}>
                    キャンセル
                  </button>
                </div>
              )}
              <div className="input-row">
                <textarea
                  placeholder="キャラクターに相談する…（Shift+Enter で送信）"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={!activeSession}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter" || !e.shiftKey) return;
                    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                    e.preventDefault();
                    handleSubmit();
                  }}
                />
                <button
                  type="button"
                  className="send"
                  onClick={handleSubmit}
                  disabled={isStreaming || !activeSession}
                  title="Shift+Enter で送信"
                >
                  ↵
                </button>
              </div>
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
