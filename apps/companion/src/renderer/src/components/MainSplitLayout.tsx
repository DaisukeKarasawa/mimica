import { useRef, type CSSProperties, type ReactNode } from "react";
import { CHAT_PANEL_MIN_WIDTH } from "../lib/chatPanelWidth";
import { useChatPanelWidth } from "../hooks/useChatPanelWidth";

interface MainSplitLayoutProps {
  stage: ReactNode;
  chat: ReactNode;
}

export function MainSplitLayout({ stage, chat }: MainSplitLayoutProps) {
  const mainRef = useRef<HTMLElement>(null);
  const { chatWidth, onHandlePointerDown, isReady } = useChatPanelWidth(mainRef);

  const style = isReady ? ({ "--chat-panel-width": `${chatWidth}px` } as CSSProperties) : undefined;

  return (
    <main ref={mainRef} className={`main${isReady ? "" : " main--split-pending"}`} style={style}>
      {stage}
      <div
        className="main-split-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label="チャットパネル幅の調整"
        aria-valuemin={CHAT_PANEL_MIN_WIDTH}
        aria-valuenow={chatWidth ?? undefined}
        onPointerDown={onHandlePointerDown}
      />
      {chat}
    </main>
  );
}
