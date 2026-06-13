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
import type { CharacterDirector } from "@mimica/character-runtime";
import { useMessageQueue } from "./useMessageQueue";

export interface UseAgentSubmitQueueOptions {
  director: CharacterDirector;
  beginStream: () => string;
  resetStream: () => void;
  setIsStreaming: Dispatch<SetStateAction<boolean>>;
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
    director,
    beginStream,
    resetStream,
    setIsStreaming,
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
  const drainInFlightRef = useRef(false);
  const [streamingSessionId, setStreamingSessionId] = useState<string | null>(null);
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
      beginStream();
      setStreamingSessionId(params.sessionId);
      setIsStreaming(true);
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
        setIsStreaming(false);
        setStreamingSessionId(null);
        resetStream();
        director.setState("idle");
        setSubmitError(message);
        return false;
      }
    },
    [beginStream, director, resetStream, setIsStreaming],
  );

  const drainQueue = useCallback(
    async (sessionId: string) => {
      if (drainInFlightRef.current) return;
      const next = messageQueue.peek(sessionId);
      if (!next) return;

      drainInFlightRef.current = true;
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
        drainInFlightRef.current = false;
      }
    },
    [messageQueue, submitToAgent],
  );

  useEffect(() => {
    onRunSettled((sessionId) => {
      setStreamingSessionId(null);
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

      const shouldQueue = streamingSessionId === saved.id;
      if (shouldQueue) {
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
      messageQueue,
      resolveWorkspacePath,
      setAllSessions,
      streamingSessionId,
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
