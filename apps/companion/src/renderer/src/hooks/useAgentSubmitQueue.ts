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

const SESSION_ALREADY_ACTIVE_ERROR = "Session already has an active agent run";

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

async function persistUserTurn(
  session: ChatSession,
  userMsg: ChatMessage,
  workspacePath: string,
  setAllSessions: Dispatch<SetStateAction<ChatSession[]>>,
): Promise<ChatSession | null> {
  let title = session.title;
  if (session.messages.length === 0) {
    const titleSource = userMsg.content.trim() || (userMsg.attachments?.length ? "Image" : "");
    title = titleSource.slice(0, 24) + (titleSource.length > 24 ? "…" : "");
  }

  const authoritative =
    (await window.mimica.listSessions()).find((s) => s.id === session.id) ?? session;
  const updated = {
    ...authoritative,
    title,
    workspacePath,
    messages: [...authoritative.messages, userMsg],
  };

  const saved = await window.mimica.saveSession(updated);
  setAllSessions((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));
  return saved;
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
  const submitPendingBySessionRef = useRef(new Set<string>());
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isEffectivelyRunning = useCallback(
    (sessionId: string) =>
      isSessionRunning(sessionId) ||
      submitPendingBySessionRef.current.has(sessionId) ||
      drainInFlightBySessionRef.current.has(sessionId),
    [isSessionRunning],
  );

  const submitToAgent = useCallback(
    async (params: {
      sessionId: string;
      content: string;
      workspacePath: string;
      mode: AgentMode;
      editorContext?: EditorContext | null;
      attachments?: ChatAttachment[];
    }): Promise<boolean> => {
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
        beginStream(params.sessionId);
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message !== SESSION_ALREADY_ACTIVE_ERROR) {
          clearSessionRun(params.sessionId);
          resetStream(params.sessionId);
        }
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
        const list = await window.mimica.listSessions();
        const session = list.find((s) => s.id === sessionId);
        if (!session) {
          messageQueue.dequeue(sessionId);
          return;
        }

        const userMsg: ChatMessage = {
          id: uuidv4(),
          role: "user",
          content: next.content,
          createdAt: new Date().toISOString(),
          context: next.editorContext ?? undefined,
          attachments: next.attachments?.length ? next.attachments : undefined,
        };

        try {
          await persistUserTurn(session, userMsg, next.workspacePath, setAllSessions);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          setSubmitError(`セッション保存失敗: ${message}`);
          return;
        }

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
      }
    },
    [messageQueue, setAllSessions, submitToAgent],
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

      if (isEffectivelyRunning(session.id)) {
        messageQueue.enqueue(session.id, {
          content,
          attachments,
          editorContext,
          agentMode,
          workspacePath,
        });
        return;
      }

      const userMsg: ChatMessage = {
        id: uuidv4(),
        role: "user",
        content,
        createdAt: new Date().toISOString(),
        context: editorContext ?? undefined,
        attachments: attachments?.length ? attachments : undefined,
      };

      submitPendingBySessionRef.current.add(session.id);
      try {
        try {
          await persistUserTurn(session, userMsg, workspacePath, setAllSessions);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          setSubmitError(`セッション保存失敗: ${message}`);
          return;
        }

        await submitToAgent({
          sessionId: session.id,
          content,
          workspacePath,
          mode: agentMode,
          editorContext,
          attachments,
        });
      } finally {
        submitPendingBySessionRef.current.delete(session.id);
      }
    },
    [
      activeSession,
      agentMode,
      editorContext,
      handleNewSession,
      isEffectivelyRunning,
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

  const clearSubmitError = useCallback(() => setSubmitError(null), []);

  return {
    handleSend,
    clearQueueForSession,
    queuedCount,
    submitError,
    clearSubmitError,
  };
}
