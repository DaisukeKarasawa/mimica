export const CHAT_PANEL_WIDTH_KEY = "mimica.chatPanelWidth";
export const CHAT_PANEL_MIN_WIDTH = 360;
export const CHAT_PANEL_MAX_RATIO = 0.65;
export const STAGE_MIN_WIDTH = 320;
export const SPLIT_HANDLE_WIDTH = 14;

export function loadChatPanelWidth(fallbackPx: number): number {
  try {
    const raw = localStorage.getItem(CHAT_PANEL_WIDTH_KEY);
    if (!raw) return fallbackPx;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= CHAT_PANEL_MIN_WIDTH ? parsed : fallbackPx;
  } catch {
    return fallbackPx;
  }
}

export function persistChatPanelWidth(width: number): void {
  localStorage.setItem(CHAT_PANEL_WIDTH_KEY, String(Math.round(width)));
}

export function defaultChatPanelWidth(containerWidth: number): number {
  return Math.max(CHAT_PANEL_MIN_WIDTH, Math.round(containerWidth * 0.32));
}

export function clampChatPanelWidth(width: number, containerWidth: number): number {
  const maxByStage = containerWidth - STAGE_MIN_WIDTH - SPLIT_HANDLE_WIDTH;
  const maxByRatio = Math.round(containerWidth * CHAT_PANEL_MAX_RATIO);
  const max = Math.max(CHAT_PANEL_MIN_WIDTH, Math.min(maxByStage, maxByRatio));
  return Math.min(max, Math.max(CHAT_PANEL_MIN_WIDTH, width));
}
