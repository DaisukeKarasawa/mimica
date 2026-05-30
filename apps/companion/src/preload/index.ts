import { contextBridge, ipcRenderer } from "electron";
import type {
  AgentEventMessage,
  AgentMode,
  CharacterMetadata,
  ChatSession,
  EditorContext,
  MotionMap,
} from "@mimica/shared";

export interface CharacterAssetStatus {
  baseUrl: string;
  assetRoot: string;
  ready: boolean;
  missing: string[];
  metadata: CharacterMetadata | null;
  motionMap: MotionMap | null;
  chatIconUrl: string | null;
}

export interface AgentSubmitPayload {
  sessionId: string;
  content: string;
  workspacePath: string;
  mode: AgentMode;
  editorContext?: EditorContext | null;
}

export interface MimicaApi {
  listSessions: () => Promise<ChatSession[]>;
  createSession: (workspacePath: string) => Promise<ChatSession>;
  switchSession: (id: string) => Promise<ChatSession | undefined>;
  deleteSession: (id: string) => Promise<void>;
  saveSession: (session: ChatSession) => Promise<ChatSession>;
  getBridgeStatus: () => Promise<{ connected: boolean; port: number }>;
  getCharacterAssets: () => Promise<CharacterAssetStatus>;
  submitAgent: (payload: AgentSubmitPayload) => Promise<void>;
  cancelAgent: () => Promise<void>;
  onEditorContext: (cb: (context: EditorContext) => void) => () => void;
  onAgentEvent: (cb: (event: AgentEventMessage) => void) => () => void;
}

const api: MimicaApi = {
  listSessions: () => ipcRenderer.invoke("sessions:list"),
  createSession: (workspacePath) => ipcRenderer.invoke("sessions:create", workspacePath),
  switchSession: (id) => ipcRenderer.invoke("sessions:switch", id),
  deleteSession: (id) => ipcRenderer.invoke("sessions:delete", id),
  saveSession: (session) => ipcRenderer.invoke("sessions:save", session),
  getBridgeStatus: () => ipcRenderer.invoke("bridge:status"),
  getCharacterAssets: () => ipcRenderer.invoke("character:assets"),
  submitAgent: (payload) => ipcRenderer.invoke("agent:submit", payload),
  cancelAgent: () => ipcRenderer.invoke("agent:cancel"),
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
};

contextBridge.exposeInMainWorld("mimica", api);

declare global {
  interface Window {
    mimica: MimicaApi;
  }
}
