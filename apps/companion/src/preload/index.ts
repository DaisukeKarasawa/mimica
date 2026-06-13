import { contextBridge, ipcRenderer } from "electron";
import type {
  AgentCancelPayload,
  AgentEventMessage,
  AgentMode,
  AgentQuestionAnswerInput,
  AgentQuestionDismissInput,
  AtMenuSection,
  CharacterAssetStatus,
  ChatAttachment,
  ChatSession,
  EditorContext,
  ErrorKind,
  ImagePastePayload,
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
  formatPersonaError: (kind: ErrorKind, detail?: string) => Promise<string>;
  submitAgent: (payload: AgentSubmitPayload) => Promise<void>;
  cancelAgent: (payload: AgentCancelPayload) => Promise<void>;
  answerAgentQuestion: (input: AgentQuestionAnswerInput) => Promise<ChatSession>;
  dismissAgentQuestion: (input: AgentQuestionDismissInput) => Promise<ChatSession>;
  openExternal: (url: string) => Promise<boolean>;
  onEditorContext: (cb: (context: EditorContext) => void) => () => void;
  onBridgeStatusChange: (cb: (status: { connected: boolean }) => void) => () => void;
  onAgentEvent: (cb: (event: AgentEventMessage) => void) => () => void;
  onChatTabShortcut: (cb: (action: ChatTabShortcutAction) => void) => () => void;
  listSlashMenu: (workspacePath: string, mode: AgentMode) => Promise<SlashMenuSection[]>;
  searchAtMenu: (
    workspacePath: string,
    query: string,
    sessionId: string | null,
  ) => Promise<AtMenuSection[]>;
  pickImageAttachments: (sessionId: string) => Promise<ChatAttachment[]>;
  pasteImageAttachment: (sessionId: string, payload: ImagePastePayload) => Promise<ChatAttachment>;
  discardImageAttachment: (sessionId: string, attachment: ChatAttachment) => Promise<void>;
  discardImageAttachments: (sessionId: string, attachments: ChatAttachment[]) => Promise<void>;
}

const api: MimicaApi = {
  listSessions: () => ipcRenderer.invoke("sessions:list"),
  createSession: (workspacePath) => ipcRenderer.invoke("sessions:create", workspacePath),
  deleteSession: (id) => ipcRenderer.invoke("sessions:delete", id),
  saveSession: (session) => ipcRenderer.invoke("sessions:save", session),
  getBridgeStatus: () => ipcRenderer.invoke("bridge:status"),
  getCharacterAssets: () => ipcRenderer.invoke("character:assets"),
  formatPersonaError: (kind, detail) => ipcRenderer.invoke("persona:formatError", kind, detail),
  submitAgent: (payload) => ipcRenderer.invoke("agent:submit", payload),
  cancelAgent: (payload) => ipcRenderer.invoke("agent:cancel", payload),
  answerAgentQuestion: (input) => ipcRenderer.invoke("agent:questionAnswer", input),
  dismissAgentQuestion: (input) => ipcRenderer.invoke("agent:questionDismiss", input),
  openExternal: (url) => ipcRenderer.invoke("shell:openExternal", url),
  onEditorContext: (cb) => {
    const handler = (_: unknown, context: EditorContext) => cb(context);
    ipcRenderer.on("editor-context", handler);
    return () => ipcRenderer.removeListener("editor-context", handler);
  },
  onBridgeStatusChange: (cb) => {
    const handler = (_: unknown, status: { connected: boolean }) => cb(status);
    ipcRenderer.on("bridge-status", handler);
    return () => ipcRenderer.removeListener("bridge-status", handler);
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
  searchAtMenu: (workspacePath, query, sessionId) =>
    ipcRenderer.invoke("atMenu:search", workspacePath, query, sessionId),
  pickImageAttachments: (sessionId) => ipcRenderer.invoke("attachments:pick", sessionId),
  pasteImageAttachment: (sessionId, payload) =>
    ipcRenderer.invoke("attachments:paste", sessionId, payload),
  discardImageAttachment: (sessionId, attachment) =>
    ipcRenderer.invoke("attachments:discard", sessionId, attachment),
  discardImageAttachments: (sessionId, attachments) =>
    ipcRenderer.invoke("attachments:discardMany", sessionId, attachments),
};

contextBridge.exposeInMainWorld("mimica", api);

declare global {
  interface Window {
    mimica: MimicaApi;
  }
}

export type { CharacterAssetStatus };
