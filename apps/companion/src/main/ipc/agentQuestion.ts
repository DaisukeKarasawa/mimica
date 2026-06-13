import type { ElectronMain } from "../electron.js";
import type { AgentService } from "../agentService.js";
import type { AgentMode, AgentQuestionAnswerPayload } from "@mimica/shared";

type IpcMain = ElectronMain["ipcMain"];

function isAgentMode(value: unknown): value is AgentMode {
  return value === "ask" || value === "agent" || value === "plan";
}

function isAnswerPayload(value: unknown): value is AgentQuestionAnswerPayload {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.questionPromptId === "string" && Array.isArray(record.answers);
}

export function registerAgentQuestionIpc(
  ipcMain: IpcMain,
  getAgentService: () => AgentService | null,
): void {
  ipcMain.handle("agent:questionAnswer", (_event, input: unknown) => {
    const service = getAgentService();
    if (!service) throw new Error("Agent service is unavailable");
    if (!input || typeof input !== "object") throw new Error("Invalid question answer payload");
    const record = input as Record<string, unknown>;
    if (typeof record.sessionId !== "string" || typeof record.runId !== "string") {
      throw new Error("Invalid question answer payload");
    }
    if (!isAgentMode(record.mode) || !isAnswerPayload(record.payload)) {
      throw new Error("Invalid question answer payload");
    }
    return service.answerQuestion({
      sessionId: record.sessionId,
      runId: record.runId,
      mode: record.mode,
      payload: record.payload,
    });
  });

  ipcMain.handle("agent:questionDismiss", (_event, input: unknown) => {
    const service = getAgentService();
    if (!service) throw new Error("Agent service is unavailable");
    if (!input || typeof input !== "object") throw new Error("Invalid question dismiss payload");
    const record = input as Record<string, unknown>;
    if (
      typeof record.sessionId !== "string" ||
      typeof record.runId !== "string" ||
      typeof record.questionPromptId !== "string"
    ) {
      throw new Error("Invalid question dismiss payload");
    }
    return service.dismissQuestion({
      sessionId: record.sessionId,
      runId: record.runId,
      questionPromptId: record.questionPromptId,
    });
  });
}
