import type { MimicaSettings } from "@mimica/shared";
import { DEFAULT_TUTTI_BASE_URL } from "@mimica/shared";
import { parseEnvBool } from "./envBool.js";

const LOCALHOST_TUTTI_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export interface TuttiVoiceConfig {
  enabled: boolean;
  baseUrl: string;
}

/** Allow only loopback tutti endpoints; rejects arbitrary outbound TTS hosts. */
export function assertLocalhostTuttiBaseUrl(raw: string): string {
  const normalized = raw.trim().replace(/\/$/, "");
  if (!normalized) {
    throw new Error("tutti base URL is empty");
  }

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error(`Invalid tutti base URL: ${raw}`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`tutti base URL must use http or https: ${raw}`);
  }

  const host = normalizeLoopbackHost(parsed.hostname);
  if (!LOCALHOST_TUTTI_HOSTS.has(host)) {
    throw new Error(`tutti base URL must target localhost (127.0.0.1, ::1, or localhost): ${host}`);
  }

  return normalized;
}

function normalizeLoopbackHost(hostname: string): string {
  const lower = hostname.toLowerCase();
  if (lower.startsWith("[") && lower.endsWith("]")) {
    return lower.slice(1, -1);
  }
  return lower;
}

function resolveRawBaseUrl(settings: MimicaSettings): string {
  const envUrl = process.env.MIMICA_TUTTI_URL?.trim();
  return (envUrl || settings.tuttiBaseUrl || DEFAULT_TUTTI_BASE_URL).replace(/\/$/, "");
}

export function resolveTuttiVoiceConfig(settings: MimicaSettings): TuttiVoiceConfig {
  const envEnabled = parseEnvBool(process.env.MIMICA_VOICE_READOUT_ENABLED);
  const enabled = envEnabled ?? settings.voiceReadoutEnabled;
  const raw = resolveRawBaseUrl(settings);

  let baseUrl: string;
  try {
    baseUrl = assertLocalhostTuttiBaseUrl(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[tuttiVoice] ${message}; using default ${DEFAULT_TUTTI_BASE_URL}`);
    baseUrl = assertLocalhostTuttiBaseUrl(DEFAULT_TUTTI_BASE_URL);
  }

  return { enabled, baseUrl };
}
