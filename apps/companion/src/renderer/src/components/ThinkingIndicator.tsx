interface ThinkingIndicatorProps {
  chatIconUrl?: string | null;
}

export function ThinkingIndicator({ chatIconUrl }: ThinkingIndicatorProps) {
  return (
    <div className="msg agent thinking-msg" aria-label="Thinking" aria-live="polite">
      {chatIconUrl ? (
        <img src={chatIconUrl} alt="" className="agent-icon" title="調月リオ" />
      ) : (
        <div className="agent-icon" title="Character icon (not set)" />
      )}
      <div className="bubble-shell">
        <div className="bubble thinking-bubble">
          <span className="thinking-dots" aria-hidden="true">
            <span>・</span>
            <span>・</span>
            <span>・</span>
          </span>
        </div>
      </div>
    </div>
  );
}
