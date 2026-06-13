import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { v4 as uuidv4 } from "uuid";
import type {
  AgentMode,
  ChatAttachment,
  ChatMessage,
  ChatSession,
  EditorContext,
} from "@mimica/shared";
import { useMessageQueue } from "./useMessageQueue";

export interface UseAgentSubmitQueueOptions {
  beginStream: (sessionId: string) => string;
  resetStream: (sessionId?: string) => void;
  clearSessionRun: (sessionId: string) => void;
  isSessionRunning: (sessionId: string) => boolean;
  onRunSettled: (handler: (sessionId: string) => void) => void;
  activeSessionId: string | null;
  activeSession: ChatSession | null;
  agentMode: AgentMode;
  editorContext: EditorContext | null;
  resolveWorkspacePath: () => string | null;
  setAllSessions: Dispatch<SetStateAction<ChatSession[]>>;
  handleNewSession: (workspacePath: string) => Promise<ChatSession>;
}

export function useAgentSubmitQueue(options: UseAgentSubmitQueueOptions) {
  const {
    beginStream,
    resetStream,
    clearSessionRun,
    isSessionRunning,
    onRunSettled,
    activeSessionId,
    activeSession,
    agentMode,
    editorContext,
    resolveWorkspacePath,
    setAllSessions,
    handleNewSession,
  } = options;

  const messageQueue = useMessageQueue();
  const drainInFlightBySessionRef = useRef(new Set<string>());
  const [submitError, setSubmitError] = useState<string | null>(null);

  const submitToAgent = useCallback(
    async (params: {
      sessionId: string;
      content: string;
      workspacePath: string;
      mode: AgentMode;
      editorContext?: EditorContext | null;
      attachments?: ChatAttachment[];
    }): Promise<boolean> => {
      beginStream(params.sessionId);
      setSubmitError(null);
      try {
        await window.mimica.submitAgent({
          sessionId: params.sessionId,
          content: params.content,
          workspacePath: params.workspacePath,
          mode: params.mode,
          editorContext: params.editorContext ?? undefined,
          attachments: params.attachments,
        });
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        clearSessionRun(params.sessionId);
        resetStream(params.sessionId);
        setSubmitError(message);
        return false;
      }
    },
    [beginStream, clearSessionRun, resetStream],
  );

  const drainQueue = useCallback(
    async (sessionId: string) => {
      if (drainInFlightBySessionRef.current.has(sessionId)) return;
      const next = messageQueue.peek(sessionId);
      if (!next) return;

      drainInFlightBySessionRef.current.add(sessionId);
      try {
        const ok = await submitToAgent({
          sessionId,
          content: next.content,
          workspacePath: next.workspacePath,
          mode: next.agentMode,
          editorContext: next.editorContext,
          attachments: next.attachments,
        });
        if (ok) {
          messageQueue.dequeue(sessionId);
        }
      } finally {
        drainInFlightBySessionRef.current.delete(sessionId);
        if (messageQueue.peek(sessionId)) {
          void drainQueue(sessionId);
        }
      }
    },
    [messageQueue, submitToAgent],
  );

  useEffect(() => {
    onRunSettled((sessionId) => {
      void drainQueue(sessionId);
    });
  }, [drainQueue, onRunSettled]);

  const handleSend = useCallback(
    async (content: string, attachments?: ChatAttachment[]) => {
      const workspacePath = resolveWorkspacePath();
      if (!workspacePath) return;

      let session = activeSession;
      if (!session) {
        session = await handleNewSession(workspacePath);
      }

      const userMsg: ChatMessage = {
        id: uuidv4(),
        role: "user",
        content,
        createdAt: new Date().toISOString(),
        context: editorContext ?? undefined,
        attachments: attachments?.length ? attachments : undefined,
      };
      let title = session.title;
      if (session.messages.length === 0) {
        const titleSource = content.trim() || (attachments?.length ? "Image" : "");
        title = titleSource.slice(0, 24) + (titleSource.length > 24 ? "…" : "");
      }
      const updated = {
        ...session,
        title,
        workspacePath,
        messages: [...session.messages, userMsg],
      };
      const saved = await window.mimica.saveSession(updated);
      setAllSessions((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));

      if (isSessionRunning(saved.id)) {
        messageQueue.enqueue(saved.id, {
          content,
          attachments,
          editorContext,
          agentMode,
          workspacePath,
        });
        return;
      }

      await submitToAgent({
        sessionId: saved.id,
        content,
        workspacePath,
        mode: agentMode,
        editorContext,
        attachments,
      });
    },
    [
      activeSession,
      agentMode,
      editorContext,
      handleNewSession,
      isSessionRunning,
      messageQueue,
      resolveWorkspacePath,
      setAllSessions,
      submitToAgent,
    ],
  );

  const clearQueueForSession = useCallback(
    (sessionId: string) => {
      messageQueue.clear(sessionId);
    },
    [messageQueue],
  );

  const queuedCount = messageQueue.getQueueSize(activeSessionId);

  return {
    handleSend,
    clearQueueForSession,
    queuedCount,
    submitError,
    clearSubmitError: () => setSubmitError(null),
  };
}
