// TODO: generate or sync from theme.css to prevent drift between CSS vars and TS tokens.
export const kanagawaDragonTheme = {
  bg: "#0d0c0c",
  bgSoft: "#12120f",
  surface: "#1D1C19",
  surface2: "#282727",
  surface3: "#393836",
  line: "rgba(98, 94, 90, .54)",
  text: "#c5c9c5",
  muted: "#9e9b93",
  subtle: "#7a8382",
  accent: "#87a987",
  accent2: "#8ba4b0",
  accent3: "#c4b28a",
  ok: "#87a987",
  warn: "#c4b28a",
  error: "#c4746e",
  bubbleUser: "rgba(138, 154, 123, .18)",
  bubbleAgent: "rgba(40, 39, 39, .78)",
  panel: "rgba(29, 28, 25, .82)",
  panelStrong: "rgba(18, 18, 15, 0.94)",
  shadow: "0 24px 80px rgba(0,0,0,.56)",
} as const;

export type ThemeName = "kanagawa-dragon";
