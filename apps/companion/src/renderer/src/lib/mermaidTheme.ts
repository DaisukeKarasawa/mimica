import mermaid from "mermaid";

/** Kanagawa Dragon–aligned Mermaid theme (dark base + CSS variables). */
const MERMAID_THEME_VARIABLES = {
  darkMode: "true",
  background: "#1d1c19",
  mainBkg: "#1d1c19",
  secondBkg: "#282727",
  tertiaryBkg: "#393836",
  primaryColor: "#c5c9c5",
  primaryTextColor: "#c5c9c5",
  secondaryColor: "#9e9b93",
  tertiaryColor: "#7a8382",
  lineColor: "#62625a",
  textColor: "#c5c9c5",
  nodeBorder: "#62625a",
  clusterBkg: "#282727",
  titleColor: "#8ba4b0",
  edgeLabelBackground: "#1d1c19",
  actorBorder: "#62625a",
  actorBkg: "#282727",
  actorTextColor: "#c5c9c5",
  signalColor: "#87a987",
  labelBoxBkgColor: "#282727",
  labelBoxBorderColor: "#62625a",
  labelTextColor: "#c5c9c5",
} as const;

let mermaidReady = false;

export function ensureMermaid(): typeof mermaid {
  if (!mermaidReady) {
    mermaid.initialize({
      startOnLoad: false,
      theme: "dark",
      securityLevel: "strict",
      themeVariables: MERMAID_THEME_VARIABLES,
      flowchart: {
        htmlLabels: false,
        useMaxWidth: false,
      },
      sequence: {
        useMaxWidth: false,
      },
    });
    mermaidReady = true;
  }
  return mermaid;
}

/** Warm mermaid so the first diagram does not wait on initialization. */
export function preloadMermaid(): void {
  ensureMermaid();
}
