interface TopBarProps {
  connected: boolean;
  agentMode: "ask" | "agent";
}

export function TopBar({ connected, agentMode }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="orb" />
        <div>
          <h1>Mimica</h1>
          <span>Cursor Agent Companion</span>
        </div>
      </div>
      <div className="top-actions">
        <div className="pill">
          <span className={`dot ${connected ? "connected" : "disconnected"}`} />
          {connected ? "Cursor 接続中" : "Cursor 未接続"}
        </div>
        <div className="pill">モード: {agentMode === "agent" ? "Agent" : "Ask"}</div>
        <div className="pill">モデル: Auto</div>
        <div className="pill">テーマ: Kanagawa Dragon</div>
      </div>
    </header>
  );
}
