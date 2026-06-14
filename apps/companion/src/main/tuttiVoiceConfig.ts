import type { MimicaSettings } from "@mimica/shared";
import { DEFAULT_TUTTI_BASE_URL } from "@mimica/shared";

export interface TuttiVoiceConfig {
  enabled: boolean;
  baseUrl: string;
}

function parseEnvBool(value: string | undefined): boolean | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return undefined;
}

export function resolveTuttiVoiceConfig(settings: MimicaSettings): TuttiVoiceConfig {
  const envUrl = process.env.MIMICA_TUTTI_URL?.trim();
  const envEnabled = parseEnvBool(process.env.MIMICA_VOICE_READOUT_ENABLED);
  const baseUrl = (envUrl || settings.tuttiBaseUrl || DEFAULT_TUTTI_BASE_URL).replace(/\/$/, "");
  const enabled = envEnabled ?? settings.voiceReadoutEnabled;
  return { enabled, baseUrl };
}
