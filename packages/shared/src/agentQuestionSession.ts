import type { AgentQuestionPrompt, AgentQuestionStatus } from "./agentQuestion.js";
import type { ChatSession } from "./chat.js";

function findAssistantRunIndex(session: ChatSession, runId: string, streamId?: string): number {
  if (streamId) {
    const streamIndex = session.messages.findIndex((m) => m.id === streamId);
    if (streamIndex >= 0) return streamIndex;
  }
  return session.messages.findIndex((m) => m.role === "assistant" && m.agentRunId === runId);
}

/** Attach or replace a structured question on the assistant turn for a run. */
export function upsertAssistantQuestion(
  session: ChatSession,
  params: { runId: string; question: AgentQuestionPrompt; streamId?: string },
): ChatSession {
  const { runId, question, streamId } = params;
  const targetIndex = findAssistantRunIndex(session, runId, streamId);

  if (targetIndex >= 0) {
    const messages = session.messages.map((m, i) =>
      i === targetIndex ? { ...m, agentRunId: runId, agentQuestion: question } : m,
    );
    return { ...session, updatedAt: new Date().toISOString(), messages };
  }

  const assistantMsg = {
    id: streamId ?? `assistant-${runId}`,
    role: "assistant" as const,
    content: "",
    createdAt: new Date().toISOString(),
    agentRunId: runId,
    agentQuestion: question,
  };
  return {
    ...session,
    updatedAt: new Date().toISOString(),
    messages: [...session.messages, assistantMsg],
  };
}

export function updateAgentQuestionStatus(
  session: ChatSession,
  questionPromptId: string,
  status: AgentQuestionStatus,
): ChatSession {
  const messages = session.messages.map((m) => {
    if (m.agentQuestion?.id !== questionPromptId) return m;
    return {
      ...m,
      agentQuestion: { ...m.agentQuestion, status } satisfies AgentQuestionPrompt,
    };
  });
  return { ...session, updatedAt: new Date().toISOString(), messages };
}

export function findAgentQuestionPrompt(
  session: ChatSession,
  questionPromptId: string,
): AgentQuestionPrompt | undefined {
  for (const message of session.messages) {
    if (message.agentQuestion?.id === questionPromptId) {
      return message.agentQuestion;
    }
  }
  return undefined;
}
