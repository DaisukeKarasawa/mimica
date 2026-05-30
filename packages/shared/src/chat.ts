export type AvatarState =
  | "idle"
  | "thinking"
  | "talking"
  | "success"
  | "error"
  | "waiting";

export type AgentRunState =
  | "idle"
  | "thinking"
  | "streaming"
  | "waiting"
  | "completed"
  | "cancelled"
  | "failed";

export type AgentMode = "ask" | "agent";

export type MessageRole = "user" | "assistant" | "system";

export interface MessageContext {
  workspacePath?: string;
  currentFilePath?: string;
  currentFileLanguage?: string;
  selectedText?: string;
  selectionStartLine?: number;
  selectionEndLine?: number;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  context?: MessageContext;
  agentRunId?: string;
  toolCalls?: ToolCallInfo[];
}

export interface ToolCallInfo {
  id: string;
  name: string;
  detail?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  workspacePath: string;
  characterId: string;
  messages: ChatMessage[];
}

export interface MimicaSettings {
  theme: "kanagawa-dragon";
  activeCharacterId: "rio";
  characterAssetRoot: string;
  motionMapPath: string;
  personaPackPath: string;
  chatIconPath: string;
  maxChatSessions: number;
  saveChatHistory: boolean;
  defaultAgentMode: AgentMode;
}

export const DEFAULT_WS_PORT = 43721;

export const AGENT_DISPLAY_NAME = "Mimica - 調月リオ";

export const DEFAULT_SETTINGS: MimicaSettings = {
  theme: "kanagawa-dragon",
  activeCharacterId: "rio",
  characterAssetRoot: "~/MimicaAssets/characters/rio",
  motionMapPath: "~/MimicaAssets/characters/rio/motion-map.json",
  personaPackPath: "~/MimicaAssets/characters/rio/persona/SKILL.md",
  chatIconPath: "~/MimicaAssets/characters/rio/icon.png",
  maxChatSessions: 5,
  saveChatHistory: true,
  defaultAgentMode: "agent",
};
