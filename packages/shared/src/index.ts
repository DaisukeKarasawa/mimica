export {
  type AgentQuestionSource,
  type AgentQuestionStatus,
  type AgentQuestionOption,
  type AgentQuestionItem,
  type AgentQuestionPrompt,
  type AgentQuestionAnswerEntry,
  type AgentQuestionAnswerPayload,
  type AgentQuestionAnswerInput,
  type AgentQuestionDismissInput,
} from "./agentQuestion.js";

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

export {
  upsertAssistantQuestion,
  updateAgentQuestionStatus,
  findAgentQuestionPrompt,
  sessionHasPendingQuestion,
} from "./agentQuestionSession.js";

export {
  upsertAssistantTurn,
  findAssistantTurnIndex,
  type UpsertAssistantTurnParams,
  type FindAssistantTurnParams,
} from "./sessionMessages.js";

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
  type CodeSymbolResult,
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
  SLASH_COMMAND_NAME_PATTERN,
  SLASH_INPUT_PATTERN,
  SLASH_MENU_OPEN_PATTERN,
  SLASH_NAME_PATTERN,
  type ParsedSlashInput,
  parseSlashInput,
  isSlashMenuOpen,
  slashMenuFilterQuery,
} from "./slashInput.js";

export {
  type AtMenuEntryKind,
  type AtMenuSectionCategory,
  type AtMenuItem,
  type AtMenuSection,
  type ResolveAtInputResult,
  AT_MENU_MAX_RESULTS,
  AT_MENU_SECTION_LABELS,
  AT_GIT_COMMIT_LABEL,
  atGitBranchLabel,
} from "./atMenu.js";

export {
  AT_MENU_OPEN_PATTERN,
  AT_PATH_TOKEN_PATTERN,
  AT_PAST_CHAT_TOKEN_PATTERN,
  AT_GIT_COMMIT_TOKEN,
  AT_CODE_TOKEN_PATTERN,
  type AtMenuScope,
  type AtPathToken,
  type AtPastChatToken,
  type AtCodeToken,
  type AtGitBranchToken,
  isAtMenuOpen,
  atMenuFilterQuery,
  atPathQueryFilterText,
  matchesAtPathQuery,
  scoreAtPathQueryMatch,
  parseAtMenuScope,
  extractAtPathTokens,
  hasResolvableAtTokens,
  extractPastChatTokens,
  extractGitCommitTokens,
  extractGitBranchTokens,
  extractCodeTokens,
  atMenuItemToken,
  atMenuItemDisplayLabel,
  replaceAtMenuSelection,
} from "./atInput.js";

export {
  type ChatAttachment,
  type ImagePastePayload,
  isChatAttachment,
  isImagePastePayload,
  MIMICA_ATTACHMENT_SCHEME,
  chatAttachmentUrl,
} from "./chat.js";

export {
  MIMICA_USER_DATA_DIR_NAME,
  MIMICA_BRIDGE_TOKEN_FILENAME,
  MIMICA_COMPANION_APP_DEFAULT_PATH,
} from "./mimicaPathConstants.js";
