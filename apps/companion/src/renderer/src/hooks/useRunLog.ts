import { useCallback, useState } from "react";
import type { AgentEventMessage } from "@mimica/shared";
import {
  appendEditedFile,
  appendRunLogEntry,
  extractEditedFilePath,
  runLogEntryFromAgentEvent,
  type EditedFileEntry,
  type RunLogEntry,
} from "../lib/runLog";

export function useRunLog() {
  const [logsBySession, setLogsBySession] = useState<Record<string, RunLogEntry[]>>({});
  const [editedFilesBySession, setEditedFilesBySession] = useState<
    Record<string, EditedFileEntry[]>
  >({});

  const getLogsForSession = useCallback(
    (sessionId: string | null): RunLogEntry[] => {
      if (!sessionId) return [];
      return logsBySession[sessionId] ?? [];
    },
    [logsBySession],
  );

  const getEditedFilesForSession = useCallback(
    (sessionId: string | null): EditedFileEntry[] => {
      if (!sessionId) return [];
      return editedFilesBySession[sessionId] ?? [];
    },
    [editedFilesBySession],
  );

  const handleAgentEvent = useCallback((event: AgentEventMessage) => {
    if (event.type === "agent_tool" && event.detail?.startsWith("running")) {
      const path = extractEditedFilePath(event.name, event.detail);
      if (path) {
        setEditedFilesBySession((prev) => ({
          ...prev,
          [event.sessionId]: appendEditedFile(prev[event.sessionId] ?? [], {
            path,
            runId: event.runId,
            toolName: event.name,
          }),
        }));
      }
    }

    setLogsBySession((prev) => {
      const sessionId = event.sessionId;
      let entries = prev[sessionId] ?? [];
      const runId = "runId" in event && typeof event.runId === "string" ? event.runId : undefined;

      if (runId && !entries.some((entry) => entry.runId === runId)) {
        entries = appendRunLogEntry(entries, {
          runId,
          kind: "state",
          label: "Run started",
        });
      }

      // Response text is shown in the chat bubble; keep errors, tools, and state in the log.
      if (event.type === "agent_delta") {
        return prev;
      }

      const mapped = runLogEntryFromAgentEvent(event);
      if (!mapped) return prev;

      if (event.type === "agent_state" && event.state === "completed") {
        const hasComplete = entries.some(
          (entry) => entry.runId === event.runId && entry.kind === "complete",
        );
        if (hasComplete) return prev;
      }

      return {
        ...prev,
        [sessionId]: appendRunLogEntry(entries, mapped),
      };
    });
  }, []);

  return { getLogsForSession, getEditedFilesForSession, handleAgentEvent };
}
