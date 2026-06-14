import { useCallback, useRef, useState } from "react";
import {
  dequeueMessage,
  enqueueMessage,
  peekMessage,
  type QueuedAgentSubmit,
} from "../lib/messageQueue";

export function useMessageQueue() {
  const queuesRef = useRef(new Map<string, QueuedAgentSubmit[]>());
  const [, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((value) => value + 1), []);

  const enqueue = useCallback(
    (sessionId: string, item: QueuedAgentSubmit) => {
      const current = queuesRef.current.get(sessionId) ?? [];
      queuesRef.current.set(sessionId, enqueueMessage(current, item));
      bump();
    },
    [bump],
  );

  const dequeue = useCallback(
    (sessionId: string): QueuedAgentSubmit | null => {
      const current = queuesRef.current.get(sessionId) ?? [];
      const { head, rest } = dequeueMessage(current);
      if (rest.length === 0) {
        queuesRef.current.delete(sessionId);
      } else {
        queuesRef.current.set(sessionId, rest);
      }
      bump();
      return head;
    },
    [bump],
  );

  const peek = useCallback((sessionId: string): QueuedAgentSubmit | null => {
    const current = queuesRef.current.get(sessionId) ?? [];
    return peekMessage(current);
  }, []);

  const getQueueSize = useCallback((sessionId: string | null): number => {
    if (!sessionId) return 0;
    return queuesRef.current.get(sessionId)?.length ?? 0;
  }, []);

  const getQueue = useCallback((sessionId: string | null): QueuedAgentSubmit[] => {
    if (!sessionId) return [];
    return [...(queuesRef.current.get(sessionId) ?? [])];
  }, []);

  const clear = useCallback(
    (sessionId: string) => {
      if (!queuesRef.current.has(sessionId)) return;
      queuesRef.current.delete(sessionId);
      bump();
    },
    [bump],
  );

  return { enqueue, dequeue, peek, getQueueSize, getQueue, clear };
}
