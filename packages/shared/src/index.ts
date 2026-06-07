export {
  DEFAULT_WS_PORT,
  AGENT_DISPLAY_NAME,
  AGENT_SHORT_NAME,
  resolveCharacterShortName,
  resolveCharacterShortNameEn,
  AGENT_SHORT_NAME_EN,
  DEFAULT_WORKSPACE_FALLBACK,
  DEFAULT_SETTINGS,
  DEFAULT_SESSION_TITLE,
  type AvatarState,
  type AgentRunState,
  type AgentMode,
  AGENT_MODE_LABELS,
  AGENT_MODES,
  cycleAgentMode,
  agentModeComposerPlaceholder,
  type MessageRole,
  type MessageContext,
  type ChatMessage,
  type ToolCallInfo,
  type ChatSession,
  hasSessionHistory,
  type MimicaSettings,
} from "./chat.js";

export { upsertAssistantTurn, type UpsertAssistantTurnParams } from "./sessionMessages.js";

export {
  type MotionMap,
  type MotionMapEntry,
  type CharacterMetadata,
  type CharacterInteractionConfig,
  type CharacterPetInteraction,
  type CharacterPetHitRegion,
  type StageCropRect,
  AVATAR_STATE_LABELS,
  avatarStatusLabel,
  avatarBadgeLabel,
} from "./avatar.js";

export { type CharacterAssetStatus } from "./assets.js";

export {
  type EditorContext,
  type ClientMessage,
  type ServerMessage,
  type CompanionMessage,
  type AgentEventMessage,
  mapAgentRunToAvatar,
} from "./protocol.js";

export { toMessageContext } from "./context.js";

export {
  type SlashCommandSource,
  type SlashCommandSummary,
  type ResolveSlashCommandResult,
} from "./slashCommands.js";

export {
  type SlashMenuCategory,
  type SlashMenuItem,
  type SlashMenuSection,
  type ResolveSlashInputResult,
  SLASH_MENU_SECTION_LABELS,
} from "./slashMenu.js";

export {
  type SlashSubagentDefinition,
  SLASH_SUBAGENT_CATALOG,
  slashSubagentsForMode,
} from "./slashSubagents.js";

export {
  SLASH_INPUT_PATTERN,
  SLASH_MENU_OPEN_PATTERN,
  SLASH_NAME_PATTERN,
  type ParsedSlashInput,
  parseSlashInput,
  isSlashMenuOpen,
  slashMenuFilterQuery,
} from "./slashInput.js";

export { type ChatAttachment, MIMICA_ATTACHMENT_SCHEME, chatAttachmentUrl } from "./chat.js";

export {
  MIMICA_USER_DATA_DIR_NAME,
  MIMICA_BRIDGE_TOKEN_FILENAME,
  MIMICA_COMPANION_APP_DEFAULT_PATH,
} from "./mimicaPathConstants.js";
