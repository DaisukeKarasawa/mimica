import type { MimicaSettings } from "@mimica/shared";
import { DEFAULT_TUTTI_BASE_URL } from "@mimica/shared";
import { parseEnvBool } from "./envBool.js";

export interface TuttiVoiceConfig {
  enabled: boolean;
  baseUrl: string;
}

export function resolveTuttiVoiceConfig(settings: MimicaSettings): TuttiVoiceConfig {
  const envUrl = process.env.MIMICA_TUTTI_URL?.trim();
  const envEnabled = parseEnvBool(process.env.MIMICA_VOICE_READOUT_ENABLED);
  const baseUrl = (envUrl || settings.tuttiBaseUrl || DEFAULT_TUTTI_BASE_URL).replace(/\/$/, "");
  const enabled = envEnabled ?? settings.voiceReadoutEnabled;
  return { enabled, baseUrl };
}
