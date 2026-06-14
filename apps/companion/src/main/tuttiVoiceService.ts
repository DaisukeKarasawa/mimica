import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AgentRunner } from "@mimica/agent-orchestrator";
import type { MimicaSettings } from "@mimica/shared";
import { generateReadoutSummary } from "./readoutSummary.js";
import { resolveTuttiVoiceConfig, type TuttiVoiceConfig } from "./tuttiVoiceConfig.js";
import { userDataJoin } from "./userDataPaths.js";

const POLL_INTERVAL_MS = 750;
const POLL_TIMEOUT_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15_000;

const TUTTI_SPEAKERS = new Set(["rio", "mari", "mine"]);

type SpeakJobResponse = {
  ok?: boolean;
  jobId?: string;
  status?: string;
  error?: { code?: string; message?: string };
};

type JobStatusResponse = SpeakJobResponse & {
  audioUrl?: string | null;
};

export interface SpeakReadoutInput {
  text: string;
  speaker: string;
  sessionId: string;
  runId: string;
  workspacePath: string;
  getRunner: () => Promise<AgentRunner>;
  settings: MimicaSettings;
  /** Fired when local playback begins (avatar talking; answer not shown yet). */
  onPlaybackStart?: () => void;
  /** Fired after playback finishes successfully (start answer reveal). */
  onPlaybackEnd?: () => void;
  /** Fired when synthesis/playback fails; UI should still show the answer. */
  onFailure?: () => void;
}

type SessionVoiceState = {
  abort: AbortController;
  jobId?: string;
};

export class TuttiVoiceService {
  private readonly sessions = new Map<string, SessionVoiceState>();
  private activePlayer: ChildProcess | null = null;
  private queue: Promise<void> = Promise.resolve();

  speakReadout(input: SpeakReadoutInput): void {
    const config = resolveTuttiVoiceConfig(input.settings);
    if (!config.enabled) {
      input.onFailure?.();
      return;
    }

    if (!input.text.trim()) {
      input.onFailure?.();
      return;
    }

    const speaker = TUTTI_SPEAKERS.has(input.speaker) ? input.speaker : "rio";
    this.cancelForSession(input.sessionId);

    const abort = new AbortController();
    this.sessions.set(input.sessionId, { abort });

    this.queue = this.queue
      .then(() => this.prepareAndRunReadout({ ...input, speaker, config, abort }))
      .catch((error: unknown) => {
        console.warn("[tuttiVoice] readout failed:", error);
      });
  }

  private async prepareAndRunReadout(
    params: SpeakReadoutInput & {
      speaker: string;
      config: TuttiVoiceConfig;
      abort: AbortController;
    },
  ): Promise<void> {
    const { speaker, config, abort, onPlaybackStart, onPlaybackEnd, onFailure } = params;
    let readoutText: string;
    try {
      const runner = await params.getRunner();
      readoutText = await generateReadoutSummary({
        runner,
        workspacePath: params.workspacePath,
        sessionId: params.sessionId,
        runId: params.runId,
        answerMarkdown: params.text,
        speaker,
        signal: abort.signal,
      });
    } catch (error) {
      if (abort.signal.aborted) return;
      console.warn("[tuttiVoice] readout summary failed:", error);
      onFailure?.();
      return;
    }

    if (!readoutText || abort.signal.aborted) {
      onFailure?.();
      return;
    }

    await this.runReadout({
      text: readoutText,
      speaker,
      sessionId: params.sessionId,
      runId: params.runId,
      config,
      abort,
      onPlaybackStart,
      onPlaybackEnd,
      onFailure,
    });
  }

  cancelForSession(sessionId: string): void {
    const state = this.sessions.get(sessionId);
    if (state) {
      state.abort.abort();
      this.sessions.delete(sessionId);
    }
    this.stopPlayback();
  }

  private stopPlayback(): void {
    const player = this.activePlayer;
    if (!player) return;
    this.activePlayer = null;
    player.kill("SIGTERM");
  }

  private async runReadout(params: {
    text: string;
    speaker: string;
    sessionId: string;
    runId?: string;
    config: TuttiVoiceConfig;
    abort: AbortController;
    onPlaybackStart?: () => void;
    onPlaybackEnd?: () => void;
    onFailure?: () => void;
  }): Promise<void> {
    const { text, speaker, sessionId, runId, config, abort, onPlaybackStart, onPlaybackEnd, onFailure } =
      params;
    const logPrefix = `[tuttiVoice] session=${sessionId}${runId ? ` run=${runId}` : ""}`;

    try {
      const jobId = await this.requestSpeak(config.baseUrl, text, speaker, abort.signal);
      const state = this.sessions.get(sessionId);
      if (!state || state.abort !== abort) return;
      state.jobId = jobId;

      const ready = await this.waitForJob(config.baseUrl, jobId, abort.signal);
      if (!ready || abort.signal.aborted) return;

      const audio = await this.fetchAudio(config.baseUrl, jobId, abort.signal);
      if (!audio || abort.signal.aborted) return;

      const cacheDir = userDataJoin("tts-cache");
      await mkdir(cacheDir, { recursive: true });
      const cachePath = join(cacheDir, `${jobId}.wav`);
      await writeFile(cachePath, audio);

      onPlaybackStart?.();
      await this.playAudio(cachePath, abort.signal);
      if (abort.signal.aborted) return;
      onPlaybackEnd?.();
      console.info(`${logPrefix} played ${jobId}`);
    } catch (error) {
      if (abort.signal.aborted) return;
      console.warn(`${logPrefix} skipped:`, error instanceof Error ? error.message : error);
      onFailure?.();
      return;
    } finally {
      const state = this.sessions.get(sessionId);
      if (state?.abort === abort) {
        this.sessions.delete(sessionId);
      }
    }
  }

  private async requestSpeak(
    baseUrl: string,
    text: string,
    speaker: string,
    signal: AbortSignal,
  ): Promise<string> {
    const response = await this.fetchJson<SpeakJobResponse>(
      `${baseUrl}/v1/speak`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          speaker,
          play: false,
          async: true,
          purpose: "mimica_readout",
        }),
        signal,
      },
    );
    if (!response.ok || !response.jobId) {
      const message = response.error?.message ?? "speak request failed";
      throw new Error(message);
    }
    return response.jobId;
  }

  private async waitForJob(
    baseUrl: string,
    jobId: string,
    signal: AbortSignal,
  ): Promise<boolean> {
    const started = Date.now();
    while (!signal.aborted) {
      if (Date.now() - started > POLL_TIMEOUT_MS) {
        throw new Error(`job ${jobId} timed out`);
      }
      const status = await this.fetchJson<JobStatusResponse>(
        `${baseUrl}/v1/jobs/${jobId}`,
        { method: "GET", signal },
      );
      if (status.status === "completed") return true;
      if (status.status === "failed" || status.status === "cancelled") {
        const message = status.error?.message ?? status.status;
        throw new Error(message);
      }
      await sleep(POLL_INTERVAL_MS, signal);
    }
    return false;
  }

  private async fetchAudio(
    baseUrl: string,
    jobId: string,
    signal: AbortSignal,
  ): Promise<Buffer | null> {
    const response = await fetch(`${baseUrl}/v1/jobs/${jobId}/audio`, {
      method: "GET",
      signal,
    });
    if (!response.ok) {
      throw new Error(`audio fetch failed (${response.status})`);
    }
    const data = new Uint8Array(await response.arrayBuffer());
    return Buffer.from(data);
  }

  private async fetchJson<T>(url: string, init: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    if (init.signal) {
      init.signal.addEventListener("abort", () => controller.abort(), { once: true });
    }
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if (!response.ok) {
        let message = `HTTP ${response.status}`;
        try {
          const payload = (await response.json()) as SpeakJobResponse;
          if (payload.error?.message) message = payload.error.message;
        } catch {
          // ignore parse errors
        }
        throw new Error(message);
      }
      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  private playAudio(path: string, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        resolve();
        return;
      }
      const player = spawn("afplay", [path], { stdio: "ignore" });
      this.activePlayer = player;
      const onAbort = () => {
        player.kill("SIGTERM");
      };
      signal.addEventListener("abort", onAbort, { once: true });
      player.on("error", (error) => {
        signal.removeEventListener("abort", onAbort);
        if (this.activePlayer === player) this.activePlayer = null;
        reject(error);
      });
      player.on("close", (code, sig) => {
        signal.removeEventListener("abort", onAbort);
        if (this.activePlayer === player) this.activePlayer = null;
        if (signal.aborted || sig === "SIGTERM") {
          resolve();
          return;
        }
        if (code === 0) {
          resolve();
          return;
        }
        reject(new Error(`afplay exited with code ${code ?? "unknown"}`));
      });
    });
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      resolve();
    };
    signal.addEventListener("abort", onAbort, { once: true });
    timer.unref?.();
  });
}

export const tuttiVoiceService = new TuttiVoiceService();
