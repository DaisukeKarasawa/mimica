import { v4 as uuidv4 } from "uuid";
import type { ChatSession, EditorContext } from "@mimica/shared";
import { DEFAULT_SESSION_TITLE, DEFAULT_WS_PORT, hasSessionHistory } from "@mimica/shared";
import type { AgentSubmitPayload, MimicaApi } from "../../../preload/index";
import { OPEN_TAB_IDS_STORAGE_KEY } from "../lib/openTabs";
import {
  createUiLabSampleSessions,
  UI_LAB_EDITOR_CONTEXT,
  UI_LAB_SESSION_IDS,
} from "./uiLabSampleData";

type EditorListener = (context: EditorContext) => void;

function cloneSessions(sessions: ChatSession[]): ChatSession[] {
  return structuredClone(sessions);
}

/**
 * In-memory Mimica API for browser-only UI Lab (Cursor Design Mode).
 * Does not persist to disk; Agent submit is a no-op.
 */
export function installUiLabStub(): void {
  if (typeof window !== "undefined" && window.mimica) {
    return;
  }

  let sessions = createUiLabSampleSessions();
  const editorListeners = new Set<EditorListener>();

  const api: MimicaApi = {
    listSessions: async () => cloneSessions(sessions),

    createSession: async (workspacePath) => {
      const session: ChatSession = {
        id: uuidv4(),
        title: DEFAULT_SESSION_TITLE,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        workspacePath,
        characterId: "rio",
        messages: [],
      };
      sessions = [...sessions, session];
      return structuredClone(session);
    },

    deleteSession: async (id) => {
      sessions = sessions.filter((s) => s.id !== id);
    },

    saveSession: async (session) => {
      const updated = { ...session, updatedAt: new Date().toISOString() };
      if (!hasSessionHistory(updated)) {
        sessions = sessions.filter((s) => s.id !== session.id);
        return structuredClone(updated);
      }
      const idx = sessions.findIndex((s) => s.id === session.id);
      if (idx >= 0) {
        const next = [...sessions];
        next[idx] = updated;
        sessions = next;
      } else {
        sessions = [...sessions, updated];
      }
      return structuredClone(updated);
    },

    getBridgeStatus: async () => ({ connected: true, port: DEFAULT_WS_PORT }),

    onBridgeStatusChange: (cb) => {
      void cb;
      return () => {};
    },

    getCharacterAssets: async () => ({
      baseUrl: "",
      assetRoot: "~/MimicaAssets/characters/rio",
      ready: false,
      missing: ["skeleton", "atlas", "textures"],
      metadata: null,
      motionMap: null,
      chatIconUrl: null,
    }),

    formatPersonaError: async (kind, detail) => {
      void kind;
      void detail;
      return "……想定外ね。\n\nエラーが発生しました。";
    },

    submitAgent: async (payload: AgentSubmitPayload) => {
      void payload;
      console.info("[ui-lab] submitAgent ignored (browser preview only)");
    },

    cancelAgent: async () => {},

    answerAgentQuestion: async (input) => {
      console.info("[ui-lab] answerAgentQuestion ignored (browser preview only)");
      const session = sessions.find((s) => s.id === input.sessionId);
      if (!session) throw new Error("Session not found");
      return structuredClone(session);
    },

    dismissAgentQuestion: async (input) => {
      console.info("[ui-lab] dismissAgentQuestion ignored (browser preview only)");
      const session = sessions.find((s) => s.id === input.sessionId);
      if (!session) throw new Error("Session not found");
      return structuredClone(session);
    },

    openExternal: async (url) => {
      console.info("[ui-lab] openExternal:", url);
      return true;
    },

    onEditorContext: (cb) => {
      editorListeners.add(cb);
      return () => editorListeners.delete(cb);
    },

    onAgentEvent: (cb) => {
      void cb;
      return () => {};
    },
    onChatTabShortcut: (cb) => {
      void cb;
      return () => {};
    },

    listSlashMenu: async () => [],
    searchAtMenu: async () => [],
    pickImageAttachments: async () => [],
    pasteImageAttachment: async () => ({
      id: "ui-lab-attachment",
      fileName: "preview.png",
      mimeType: "image/png",
      storagePath: "ui-lab-attachment.png",
    }),
    discardImageAttachment: async () => {},
    discardImageAttachments: async () => {},
  };

  window.mimica = api;
  document.documentElement.dataset.uiLab = "true";

  const emitEditorContext = () => {
    for (const cb of editorListeners) {
      cb(UI_LAB_EDITOR_CONTEXT);
    }
  };

  queueMicrotask(emitEditorContext);

  // Seed open tabs when localStorage is empty (Design Mode baseline).
  if (!localStorage.getItem(OPEN_TAB_IDS_STORAGE_KEY)) {
    localStorage.setItem(
      OPEN_TAB_IDS_STORAGE_KEY,
      JSON.stringify([
        UI_LAB_SESSION_IDS.impl,
        UI_LAB_SESSION_IDS.bug,
        UI_LAB_SESSION_IDS.review,
        UI_LAB_SESSION_IDS.askQuestions,
      ]),
    );
  }

  console.info(
    "[ui-lab] Mimica stub ready — edit styles in-repo, use Cursor Design Mode, then Apply.",
  );
}
