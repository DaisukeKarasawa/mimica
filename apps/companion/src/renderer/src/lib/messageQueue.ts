import type { AgentMode, ChatAttachment, EditorContext } from "@mimica/shared";

export interface QueuedAgentSubmit {
  content: string;
  attachments?: ChatAttachment[];
  editorContext?: EditorContext | null;
  agentMode: AgentMode;
  workspacePath: string;
}

export function enqueueMessage(
  queue: QueuedAgentSubmit[],
  item: QueuedAgentSubmit,
): QueuedAgentSubmit[] {
  return [...queue, item];
}

export function dequeueMessage(queue: QueuedAgentSubmit[]): {
  head: QueuedAgentSubmit | null;
  rest: QueuedAgentSubmit[];
} {
  if (queue.length === 0) {
    return { head: null, rest: [] };
  }
  const [head, ...rest] = queue;
  return { head: head!, rest };
}

export function queueSize(queue: QueuedAgentSubmit[]): number {
  return queue.length;
}
