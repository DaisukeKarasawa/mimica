import type { WebContents } from "electron";
import type { AgentRunner } from "@mimica/agent-orchestrator";
import { getActiveMimicaSettings } from "./characterPack.js";
import { emitAgentEvent } from "./agentRunEmitter.js";
import { resolveTuttiVoiceConfig } from "./tuttiVoiceConfig.js";
import { tuttiVoiceService, type SpeakReadoutInput } from "./tuttiVoiceService.js";

export interface DeliverAnswerInput {
  wc: WebContents | undefined;
  sessionId: string;
  runId: string;
  content: string;
  workspacePath: string;
  getRunner: () => Promise<AgentRunner>;
  /** @deprecated Prefer awaiting the Promise returned by {@link deliver}. */
  onDelivered?: () => void;
}

type PendingDelivery = {
  runId: string;
  content: string;
  wc: WebContents | undefined;
  sessionId: string;
  onDelivered?: () => void;
};

export type VoiceReadoutPort = {
  speakReadout(input: SpeakReadoutInput): void;
  cancelForSession(sessionId: string): void;
  cancelAllSessions?(): void;
};

/**
 * Delays `agent_complete` until tutti readout finishes (when voice is enabled).
 * Tracks pending deliveries so cancel works after the agent run ends.
 */
export class AnswerDeliveryCoordinator {
  private readonly pending = new Map<string, PendingDelivery>();

  constructor(private readonly voiceService: VoiceReadoutPort = tuttiVoiceService) {}

  hasPending(sessionId: string): boolean {
    return this.pending.has(sessionId);
  }

  /** Returns a promise that resolves once this run's answer reaches the renderer. */
  deliver(input: DeliverAnswerInput): Promise<void> {
    return new Promise((resolve) => {
      const notifyDelivered = (): void => {
        input.onDelivered?.();
        resolve();
      };

      const settings = getActiveMimicaSettings();
      const voiceConfig = resolveTuttiVoiceConfig(settings);

      if (!voiceConfig.enabled) {
        this.emitComplete(input.wc, input.sessionId, input.runId, input.content);
        notifyDelivered();
        return;
      }

      const superseded = this.pending.get(input.sessionId);
      if (superseded && superseded.runId !== input.runId) {
        this.deliverOnce(input.sessionId, superseded.runId);
      }

      this.pending.set(input.sessionId, {
        runId: input.runId,
        content: input.content,
        wc: input.wc,
        sessionId: input.sessionId,
        onDelivered: notifyDelivered,
      });

      emitAgentEvent(input.wc, {
        type: "agent_readout",
        sessionId: input.sessionId,
        runId: input.runId,
        phase: "preparing",
      });

      this.voiceService.speakReadout({
        text: input.content,
        speaker: settings.activeCharacterId,
        sessionId: input.sessionId,
        runId: input.runId,
        workspacePath: input.workspacePath,
        getRunner: input.getRunner,
        settings,
        config: voiceConfig,
        onPlaybackStart: () => {
          emitAgentEvent(input.wc, {
            type: "agent_readout",
            sessionId: input.sessionId,
            runId: input.runId,
            phase: "start",
          });
        },
        onPlaybackEnd: () => {
          emitAgentEvent(input.wc, {
            type: "agent_readout",
            sessionId: input.sessionId,
            runId: input.runId,
            phase: "end",
          });
          this.deliverOnce(input.sessionId, input.runId);
        },
        onFailure: () => {
          this.deliverOnce(input.sessionId, input.runId);
        },
      });
    });
  }

  /** Stop voice/readout and show the answer immediately (user cancel or session close). */
  cancelSession(sessionId: string): void {
    this.voiceService.cancelForSession(sessionId);
    const pending = this.pending.get(sessionId);
    if (pending) {
      this.deliverOnce(sessionId, pending.runId);
    }
  }

  cancelAll(): void {
    for (const sessionId of [...this.pending.keys()]) {
      this.cancelSession(sessionId);
    }
    this.voiceService.cancelAllSessions?.();
  }

  private deliverOnce(sessionId: string, runId: string): void {
    const pending = this.pending.get(sessionId);
    if (!pending || pending.runId !== runId) return;
    this.pending.delete(sessionId);
    this.emitComplete(pending.wc, pending.sessionId, pending.runId, pending.content);
    pending.onDelivered?.();
  }

  private emitComplete(
    wc: WebContents | undefined,
    sessionId: string,
    runId: string,
    content: string,
  ): void {
    emitAgentEvent(wc, {
      type: "agent_complete",
      sessionId,
      runId,
      content,
    });
  }
}

export const answerDeliveryCoordinator = new AnswerDeliveryCoordinator();
