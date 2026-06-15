import type { MimicaSettings } from "@mimica/shared";
import { DEFAULT_TUTTI_BASE_URL } from "@mimica/shared";
import { parseEnvBool } from "./envBool.js";

export interface TuttiVoiceConfig {
  enabled: boolean;
  baseUrl: string;
}

const LOCALHOST_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/** Restrict tutti HTTP endpoints to localhost so readout text never leaves the machine. */
export function isLocalhostTuttiUrl(baseUrl: string): boolean {
  try {
    const parsed = new URL(baseUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase().replace(/^\[(.*)\]$/, "$1");
    return LOCALHOST_HOSTS.has(host);
  } catch {
    return false;
  }
}

export function resolveTuttiVoiceConfig(settings: MimicaSettings): TuttiVoiceConfig {
  const envUrl = process.env.MIMICA_TUTTI_URL?.trim();
  const envEnabled = parseEnvBool(process.env.MIMICA_VOICE_READOUT_ENABLED);
  const baseUrl = (envUrl || settings.tuttiBaseUrl || DEFAULT_TUTTI_BASE_URL).replace(/\/$/, "");
  const enabled = envEnabled ?? settings.voiceReadoutEnabled;

  if (!isLocalhostTuttiUrl(baseUrl)) {
    console.warn(`[tuttiVoice] rejecting non-localhost base URL: ${baseUrl}`);
    return { enabled: false, baseUrl: DEFAULT_TUTTI_BASE_URL };
  }

  return { enabled, baseUrl };
}
