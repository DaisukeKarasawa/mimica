import type { AgentEventMessage, AgentRunState } from "@mimica/shared";

export type RunLogEntryKind =
  | "state"
  | "text"
  | "tool"
  | "warning"
  | "complete"
  | "error"
  | "question";

export interface RunLogEntry {
  id: string;
  at: string;
  runId: string;
  kind: RunLogEntryKind;
  label: string;
  detail?: string;
}

export interface EditedFileEntry {
  path: string;
  runId: string;
  toolName: string;
  at: string;
}

const FILE_EDIT_TOOL_RE =
  /^(write|edit|delete|apply_?patch|create|str_?replace|edit_?notebook|search_?replace)/i;

export function isFileEditTool(name: string): boolean {
  return FILE_EDIT_TOOL_RE.test(name.trim());
}

export function extractEditedFilePath(toolName: string, detail?: string): string | null {
  if (!isFileEditTool(toolName) || !detail?.trim()) return null;

  const parts = detail
    .split("·")
    .map((part) => part.trim())
    .filter(Boolean);
  const candidate = parts.length >= 2 ? parts[parts.length - 1] : parts[0];
  if (!candidate) return null;

  if (/^(running|completed|error|pending)$/i.test(candidate)) return null;
  if (candidate.startsWith("{")) {
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      for (const key of ["path", "target_file", "file_path", "target_notebook"] as const) {
        const value = parsed[key];
        if (typeof value === "string" && value.trim()) {
          return value.trim();
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  return candidate;
}

export function appendEditedFile(
  files: EditedFileEntry[],
  entry: Omit<EditedFileEntry, "at">,
): EditedFileEntry[] {
  const filtered = files.filter((file) => file.path !== entry.path);
  return [{ ...entry, at: new Date().toISOString() }, ...filtered];
}

export function agentRunStateLabel(state: AgentRunState): string {
  switch (state) {
    case "thinking":
      return "Thinking…";
    case "streaming":
      return "Generating response…";
    case "waiting":
      return "Waiting for input…";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    case "idle":
    default:
      return "Idle";
  }
}

export function appendRunLogEntry(
  entries: RunLogEntry[],
  entry: Omit<RunLogEntry, "id" | "at">,
): RunLogEntry[] {
  return [
    ...entries,
    {
      ...entry,
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
    },
  ];
}

export function runLogEntryFromAgentEvent(
  event: AgentEventMessage,
): Omit<RunLogEntry, "id" | "at"> | null {
  switch (event.type) {
    case "agent_state":
      if (!event.runId) return null;
      return {
        runId: event.runId,
        kind: "state",
        label: agentRunStateLabel(event.state),
      };
    case "agent_delta":
      return null;
    case "agent_tool":
      return {
        runId: event.runId,
        kind: "tool",
        label: event.name,
        detail: event.detail,
      };
    case "agent_warning":
      return {
        runId: "session",
        kind: "warning",
        label: "Warning",
        detail: event.message,
      };
    case "agent_complete":
      return {
        runId: event.runId,
        kind: "complete",
        label: "Response finalized",
      };
    case "agent_error":
      return {
        runId: event.runId,
        kind: "error",
        label: "Error",
        detail: event.message,
      };
    case "agent_question":
      return {
        runId: event.runId,
        kind: "question",
        label: "Question",
        detail: event.question.title ?? event.question.questions[0]?.prompt,
      };
    default:
      return null;
  }
}
