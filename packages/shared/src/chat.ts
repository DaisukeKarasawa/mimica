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

export interface ChatAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  /** Relative path under userData/sessions/{sessionId}/attachments/ */
  storagePath: string;
}

export interface ImagePastePayload {
  mimeType: string;
  /** Base64-encoded image bytes; format validation is deferred to main-side persistence. */
  data: string;
}

/** Structural guard only; does not validate base64 or image contents. */
export function isImagePastePayload(payload: unknown): payload is ImagePastePayload {
  return (
    !!payload &&
    typeof payload === "object" &&
    "mimeType" in payload &&
    "data" in payload &&
    typeof payload.mimeType === "string" &&
    typeof payload.data === "string"
  );
}

/** Structural guard only; path safety must be validated by main-side code (e.g. imageAttachments). */
export function isChatAttachment(value: unknown): value is ChatAttachment {
  return (
    !!value &&
    typeof value === "object" &&
    "id" in value &&
    "fileName" in value &&
    "mimeType" in value &&
    "storagePath" in value &&
    typeof value.id === "string" &&
    typeof value.fileName === "string" &&
    typeof value.mimeType === "string" &&
    typeof value.storagePath === "string"
  );
}

export const MIMICA_ATTACHMENT_SCHEME = "mimica-attachment";

export function chatAttachmentUrl(sessionId: string, storagePath: string): string {
  return `${MIMICA_ATTACHMENT_SCHEME}:///${sessionId}/${storagePath}`;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  context?: MessageContext;
  agentRunId?: string;
  toolCalls?: ToolCallInfo[];
  attachments?: ChatAttachment[];
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

/** True when the session has any persisted messages (user or assistant). */
export function hasSessionHistory(session: Pick<ChatSession, "messages">): boolean {
  return session.messages.length > 0;
}

export interface MimicaSettings {
  theme: "kanagawa-dragon";
  activeCharacterId: string;
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
    if (short === AGENT_SHORT_NAME || display === AGENT_DISPLAY_NAME || metadata?.id === "rio") {
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

/** UI Lab / dev stubs only — consumer flows must use live `editorContext.workspacePath`. */
export const DEFAULT_WORKSPACE_FALLBACK = "~/dev/mimica";

/** Renderer-safe defaults; Companion main resolves packs at runtime. */
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
