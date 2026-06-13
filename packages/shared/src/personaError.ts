/** Companion error taxonomy for persona-aware user messages. */
export type ErrorKind =
  | "agent_failed"
  | "agent_timeout"
  | "auth_missing"
  | "connection"
  | "attachment"
  | "session"
  | "read_only_blocked"
  | "cancelled"
  | "generic";

export type PersonaReactionState = "thinking" | "success" | "error" | "waiting" | "cancelled";

export interface PersonaReactions {
  thinking?: string[];
  success?: string[];
  error?: string[];
  waiting?: string[];
  cancelled?: string[];
  /** Kind-specific persona intro lines (keys match ErrorKind). */
  error_by_kind?: Partial<Record<ErrorKind, string[]>>;
}

/** Typed agent run failure emitted by orchestrator; companion formats for display. */
export interface AgentRunError {
  kind: ErrorKind;
  /** Technical detail for logs and optional user-facing fact line. */
  detail?: string;
}

export function agentRunError(kind: ErrorKind, detail?: string): AgentRunError {
  return detail ? { kind, detail } : { kind };
}

/** Format a raw or typed error for user-visible composer / IPC copy. */
export function formatPersonaErrorMessage(
  input: string | AgentRunError,
  reactions?: PersonaReactions,
): string {
  if (typeof input !== "string") {
    return buildPersonaErrorMessage(input.kind, input.detail, reactions);
  }
  return buildPersonaErrorMessage(classifyAgentError(input), input, reactions);
}

const ERROR_KINDS: ErrorKind[] = [
  "agent_failed",
  "agent_timeout",
  "auth_missing",
  "connection",
  "attachment",
  "session",
  "read_only_blocked",
  "cancelled",
  "generic",
];

const GENERIC_FACT_FALLBACK = "エラーが発生しました。";
const GENERIC_INTRO_FALLBACK = "……想定外ね。";
const GENERIC_DETAIL_MAX_LEN = 120;

const ERROR_FACT_TEMPLATES: Record<ErrorKind, string> = {
  agent_failed: "Agent の実行に失敗しました。",
  agent_timeout: "応答がタイムアウトしました。",
  auth_missing:
    "Cursor API キーが設定されていません。.env または環境変数 CURSOR_API_KEY を確認してください。",
  connection: "接続を確立できませんでした。Companion と Cursor の接続を確認してください。",
  attachment: "画像の添付に失敗しました。",
  session: "チャットセッションが見つかりません。",
  read_only_blocked: "Ask モードでは書き込みツールは利用できません。",
  cancelled: "処理が中断されました。",
  generic: GENERIC_FACT_FALLBACK,
};

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === "string" && item.trim().length > 0)
  );
}

function pickFirstLine(lines: string[] | undefined): string | undefined {
  if (!lines || lines.length === 0) return undefined;
  return lines[0]?.trim() || undefined;
}

function truncateDetail(detail: string, maxLen = GENERIC_DETAIL_MAX_LEN): string {
  const trimmed = detail.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen)}…`;
}

function isErrorKind(value: string): value is ErrorKind {
  return (ERROR_KINDS as string[]).includes(value);
}

/** Parse `reactions` from a parsed lines.json object. */
export function parsePersonaReactions(data: unknown): PersonaReactions | null {
  if (!data || typeof data !== "object") return null;
  const reactionsRaw = (data as { reactions?: unknown }).reactions;
  if (!reactionsRaw || typeof reactionsRaw !== "object") return null;

  const raw = reactionsRaw as Record<string, unknown>;
  const reactions: PersonaReactions = {};

  for (const key of ["thinking", "success", "error", "waiting", "cancelled"] as const) {
    if (isStringArray(raw[key])) {
      reactions[key] = raw[key];
    }
  }

  const byKindRaw = raw.error_by_kind;
  if (byKindRaw && typeof byKindRaw === "object") {
    const errorByKind: Partial<Record<ErrorKind, string[]>> = {};
    for (const [key, value] of Object.entries(byKindRaw)) {
      if (isErrorKind(key) && isStringArray(value)) {
        errorByKind[key] = value;
      }
    }
    if (Object.keys(errorByKind).length > 0) {
      reactions.error_by_kind = errorByKind;
    }
  }

  const hasContent =
    (reactions.thinking?.length ?? 0) > 0 ||
    (reactions.success?.length ?? 0) > 0 ||
    (reactions.error?.length ?? 0) > 0 ||
    (reactions.waiting?.length ?? 0) > 0 ||
    (reactions.cancelled?.length ?? 0) > 0 ||
    (reactions.error_by_kind && Object.keys(reactions.error_by_kind).length > 0);

  return hasContent ? reactions : null;
}

/** Parse reactions from lines.json text. Returns null on invalid JSON or missing reactions. */
export function parsePersonaLinesJson(json: string): PersonaReactions | null {
  try {
    return parsePersonaReactions(JSON.parse(json) as unknown);
  } catch {
    return null;
  }
}

/** Classify a raw error message into ErrorKind. */
export function classifyAgentError(raw: string, errorName?: string): ErrorKind {
  const message = raw.trim();
  if (!message) return "generic";

  if (
    errorName === "AbortError" ||
    /\bcancel(?:led|ed)?\b/i.test(message) ||
    /中断/.test(message)
  ) {
    return "cancelled";
  }
  if (/CURSOR_API_KEY/i.test(message)) {
    return "auth_missing";
  }
  if (
    /read-only mode/i.test(message) ||
    /書き込みツール/i.test(message) ||
    /MVP では利用できません/.test(message)
  ) {
    return "read_only_blocked";
  }
  if (
    /bridge|websocket|ECONNREFUSED|ws:\/\//i.test(message) ||
    /Companion.*接続|接続.*Companion/.test(message)
  ) {
    return "connection";
  }
  if (/timeout|タイムアウト/i.test(message)) {
    return "agent_timeout";
  }
  if (/Session is required/i.test(message)) {
    return "session";
  }
  if (/Maximum \d+ images/i.test(message)) {
    return "attachment";
  }
  if (/session|セッション/i.test(message) && !/画像|添付|attachment|image/i.test(message)) {
    return "session";
  }
  if (/画像|添付|attachment|image/i.test(message)) {
    return "attachment";
  }
  if (/Unsupported image|too large|exceeds.*\d+MB/i.test(message)) {
    return "attachment";
  }
  if (/Agent.*失敗|run failed|status.*error/i.test(message)) {
    return "agent_failed";
  }

  return "generic";
}

/** Classify unknown thrown values; use only when the source cannot emit a known kind. */
export function agentRunErrorFromUnknown(err: unknown): AgentRunError {
  if (err instanceof Error) {
    return { kind: classifyAgentError(err.message, err.name), detail: err.message };
  }
  const detail = String(err);
  return { kind: classifyAgentError(detail), detail };
}

function pickPersonaIntro(kind: ErrorKind, reactions?: PersonaReactions): string | undefined {
  const byKind = reactions?.error_by_kind?.[kind];
  const fromKind = pickFirstLine(byKind);
  if (fromKind) return fromKind;

  if (kind === "cancelled") {
    return pickFirstLine(reactions?.cancelled);
  }

  const genericError = pickFirstLine(reactions?.error);
  if (genericError) return genericError;

  if (kind !== "generic") {
    const fallbackKind = pickFirstLine(reactions?.error_by_kind?.generic);
    if (fallbackKind) return fallbackKind;
  }

  return undefined;
}

function buildFactLine(kind: ErrorKind, detail?: string): string {
  const trimmedDetail = detail?.trim();
  if (trimmedDetail) {
    return truncateDetail(trimmedDetail);
  }
  return ERROR_FACT_TEMPLATES[kind];
}

/**
 * Build a persona-aware error message:
 * persona intro (1 line) + blank line + short factual explanation.
 */
export function buildPersonaErrorMessage(
  kind: ErrorKind,
  detail?: string,
  reactions?: PersonaReactions,
): string {
  const intro = pickPersonaIntro(kind, reactions) ?? GENERIC_INTRO_FALLBACK;
  const fact = buildFactLine(kind, detail);
  return `${intro}\n\n${fact}`;
}

/** Pick a persona reaction line for avatar status / badge (Phase 4). */
export function pickPersonaReactionLine(
  reactions: PersonaReactions | undefined,
  key: PersonaReactionState,
): string | undefined {
  return pickFirstLine(reactions?.[key]);
}
