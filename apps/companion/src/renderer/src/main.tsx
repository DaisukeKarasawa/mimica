import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { installUiLabStub } from "./dev/installUiLabStub";
import "@mimica/ui/theme.css";
import "./styles/shell.css";
import "./styles/stage.css";
import "./styles/stage-placeholder.css";
import "./styles/chat.css";
import "./styles/chat-code-block.css";
import "./styles/chat-mermaid.css";
import "./styles/chat-slash-menu.css";
import "./styles/chat-attachments.css";
import "./styles/chat-question-card.css";
import "./styles/ui-lab.css";

if (import.meta.env.VITE_UI_LAB === "true") {
  installUiLabStub();
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root not found");
}
createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
