export type AvatarState =
  | "idle"
  | "thinking"
  | "talking"
  | "success"
  | "error"
  | "waiting"
  | "cancelled";

export type AgentRunState =
  | "idle"
  | "thinking"
  | "streaming"
  | "waiting"
  | "completed"
  | "cancelled"
  | "failed";

export type AgentMode = "ask" | "agent" | "plan";

export const AGENT_MODE_LABELS: Record<AgentMode, string> = {
  ask: "Ask",
  agent: "Agent",
  plan: "Plan",
};

export const AGENT_MODES: readonly AgentMode[] = ["ask", "agent", "plan"];

export function cycleAgentMode(mode: AgentMode, direction: 1 | -1): AgentMode {
  const index = AGENT_MODES.indexOf(mode);
  const next = (index + direction + AGENT_MODES.length) % AGENT_MODES.length;
  return AGENT_MODES[next]!;
}

export function agentModeComposerPlaceholder(mode: AgentMode, characterShortName: string): string {
  const lead: Record<AgentMode, string> = {
    ask: `Ask ${characterShortName} a question…`,
    agent: `Ask ${characterShortName} for help…`,
    plan: `Plan with ${characterShortName}…`,
  };
  return lead[mode];
}

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

/** True once the user has sent at least one message in the session. */
export function hasSessionHistory(session: Pick<ChatSession, "messages">): boolean {
  return session.messages.length > 0;
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

export const DEFAULT_SESSION_TITLE = "New Chat";

export const AGENT_DISPLAY_NAME = "調月リオ";

/** Default short name when metadata has no shortDisplayName (調月リオ → リオ). */
export const AGENT_SHORT_NAME = "リオ";

/** Romanized short name for English composer placeholders. */
export const AGENT_SHORT_NAME_EN = "Rio";

type CharacterNameMetadata = {
  id?: string;
  displayName?: string;
  shortDisplayName?: string;
  shortDisplayNameEn?: string;
};

export type CharacterNameLocale = "ja" | "en";

function resolveShortName(
  metadata: CharacterNameMetadata | null | undefined,
  locale: CharacterNameLocale,
): string {
  if (locale === "en") {
    const shortEn = metadata?.shortDisplayNameEn?.trim();
    if (shortEn) return shortEn;
    const short = metadata?.shortDisplayName?.trim();
    const display = metadata?.displayName?.trim();
    if (
      short === AGENT_SHORT_NAME ||
      display === AGENT_DISPLAY_NAME ||
      metadata?.id === "rio"
    ) {
      return AGENT_SHORT_NAME_EN;
    }
    if (short) return short;
    if (display) return display;
    return AGENT_SHORT_NAME_EN;
  }

  const short = metadata?.shortDisplayName?.trim();
  if (short) return short;
  const display = metadata?.displayName?.trim();
  if (display === AGENT_DISPLAY_NAME) return AGENT_SHORT_NAME;
  if (display) return display;
  return AGENT_SHORT_NAME;
}

export function resolveCharacterShortName(metadata?: CharacterNameMetadata | null): string {
  return resolveShortName(metadata, "ja");
}

export function resolveCharacterShortNameEn(metadata?: CharacterNameMetadata | null): string {
  return resolveShortName(metadata, "en");
}

/** Fallback when the Cursor extension has not yet sent workspace context. */
export const DEFAULT_WORKSPACE_FALLBACK = "~/dev/mimica";

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
