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
  MIMICA_USER_DATA_DIR_NAME,
  MIMICA_BRIDGE_TOKEN_FILENAME,
  MIMICA_COMPANION_APP_DEFAULT_PATH,
  mimicaUserDataDir,
  mimicaBridgeTokenPath,
} from "./mimicaPaths.js";
