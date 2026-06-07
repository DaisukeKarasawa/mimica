import { contextBridge, ipcRenderer } from "electron";
import type {
  AgentEventMessage,
  AgentMode,
  CharacterAssetStatus,
  ChatAttachment,
  ChatSession,
  EditorContext,
  SlashMenuSection,
} from "@mimica/shared";
import type { ChatTabShortcutAction } from "../common/chatTabShortcuts.js";

export interface AgentSubmitPayload {
  sessionId: string;
  content: string;
  workspacePath: string;
  mode: AgentMode;
  editorContext?: EditorContext | null;
  attachments?: ChatAttachment[];
}

export interface MimicaApi {
  listSessions: () => Promise<ChatSession[]>;
  createSession: (workspacePath: string) => Promise<ChatSession>;
  deleteSession: (id: string) => Promise<void>;
  saveSession: (session: ChatSession) => Promise<ChatSession>;
  getBridgeStatus: () => Promise<{ connected: boolean; port: number }>;
  getCharacterAssets: () => Promise<CharacterAssetStatus>;
  submitAgent: (payload: AgentSubmitPayload) => Promise<void>;
  cancelAgent: () => Promise<void>;
  openExternal: (url: string) => Promise<boolean>;
  onEditorContext: (cb: (context: EditorContext) => void) => () => void;
  onAgentEvent: (cb: (event: AgentEventMessage) => void) => () => void;
  onChatTabShortcut: (cb: (action: ChatTabShortcutAction) => void) => () => void;
  listSlashMenu: (workspacePath: string, mode: AgentMode) => Promise<SlashMenuSection[]>;
  pickImageAttachments: (sessionId: string, currentCount: number) => Promise<ChatAttachment[]>;
  pasteImageAttachment: (
    sessionId: string,
    payload: { mimeType: string; data: string },
  ) => Promise<ChatAttachment>;
}

const api: MimicaApi = {
  listSessions: () => ipcRenderer.invoke("sessions:list"),
  createSession: (workspacePath) => ipcRenderer.invoke("sessions:create", workspacePath),
  deleteSession: (id) => ipcRenderer.invoke("sessions:delete", id),
  saveSession: (session) => ipcRenderer.invoke("sessions:save", session),
  getBridgeStatus: () => ipcRenderer.invoke("bridge:status"),
  getCharacterAssets: () => ipcRenderer.invoke("character:assets"),
  submitAgent: (payload) => ipcRenderer.invoke("agent:submit", payload),
  cancelAgent: () => ipcRenderer.invoke("agent:cancel"),
  openExternal: (url) => ipcRenderer.invoke("shell:openExternal", url),
  onEditorContext: (cb) => {
    const handler = (_: unknown, context: EditorContext) => cb(context);
    ipcRenderer.on("editor-context", handler);
    return () => ipcRenderer.removeListener("editor-context", handler);
  },
  onAgentEvent: (cb) => {
    const handler = (_: unknown, event: AgentEventMessage) => cb(event);
    ipcRenderer.on("agent-event", handler);
    return () => ipcRenderer.removeListener("agent-event", handler);
  },
  onChatTabShortcut: (cb) => {
    const handler = (_: unknown, action: ChatTabShortcutAction) => cb(action);
    ipcRenderer.on("chat-tab-shortcut", handler);
    return () => ipcRenderer.removeListener("chat-tab-shortcut", handler);
  },
  listSlashMenu: (workspacePath, mode) => ipcRenderer.invoke("slashMenu:list", workspacePath, mode),
  pickImageAttachments: (sessionId, currentCount) =>
    ipcRenderer.invoke("attachments:pick", sessionId, currentCount),
  pasteImageAttachment: (sessionId, payload) =>
    ipcRenderer.invoke("attachments:paste", sessionId, payload),
};

contextBridge.exposeInMainWorld("mimica", api);

declare global {
  interface Window {
    mimica: MimicaApi;
  }
}

export type { CharacterAssetStatus };
