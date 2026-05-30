import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "@mimica/ui/theme.css";
import "./styles/shell.css";
import "./styles/stage.css";
import "./styles/stage-placeholder.css";
import "./styles/chat.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
