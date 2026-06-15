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
}

type PendingDelivery = {
  runId: string;
  content: string;
  wc: WebContents | undefined;
  sessionId: string;
};

export type VoiceReadoutPort = {
  speakReadout(input: SpeakReadoutInput): void;
  cancelForSession(sessionId: string): void;
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

  deliver(input: DeliverAnswerInput): void {
    const settings = getActiveMimicaSettings();
    const voiceConfig = resolveTuttiVoiceConfig(settings);

    if (!voiceConfig.enabled) {
      this.emitComplete(input.wc, input.sessionId, input.runId, input.content);
      return;
    }

    const superseded = this.pending.get(input.sessionId);
    if (superseded && superseded.runId !== input.runId) {
      this.emitComplete(superseded.wc, superseded.sessionId, superseded.runId, superseded.content);
    }

    this.pending.set(input.sessionId, {
      runId: input.runId,
      content: input.content,
      wc: input.wc,
      sessionId: input.sessionId,
    });

    emitAgentEvent(input.wc, {
      type: "agent_state",
      sessionId: input.sessionId,
      runId: input.runId,
      state: "thinking",
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
  }

  /** Stop voice/readout and show the answer immediately (user cancel or session close). */
  cancelSession(sessionId: string): void {
    this.voiceService.cancelForSession(sessionId);
    const pending = this.pending.get(sessionId);
    if (pending) {
      this.deliverOnce(sessionId, pending.runId);
    }
  }

  private deliverOnce(sessionId: string, runId: string): void {
    const pending = this.pending.get(sessionId);
    if (!pending || pending.runId !== runId) return;
    this.pending.delete(sessionId);
    this.emitComplete(pending.wc, pending.sessionId, pending.runId, pending.content);
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
