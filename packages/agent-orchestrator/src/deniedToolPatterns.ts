import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

interface DeniedToolsConfig {
  streamWritePrefixes: string[];
  askDeniedExtraStreamPrefixes: string[];
  hookToolNames: string[];
}

function loadDeniedToolsConfig(): DeniedToolsConfig {
  const policyDir = join(dirname(fileURLToPath(import.meta.url)), "../policy");
  return JSON.parse(
    readFileSync(join(policyDir, "denied-tools.json"), "utf8"),
  ) as DeniedToolsConfig;
}

function prefixRe(prefixes: string[]): RegExp {
  return new RegExp(`^(${prefixes.join("|")})`, "i");
}

const config = loadDeniedToolsConfig();
const askDeniedPrefixes = [...config.streamWritePrefixes, ...config.askDeniedExtraStreamPrefixes];

export const WRITE_TOOL_RE = prefixRe(config.streamWritePrefixes);
export const ASK_DENIED_STREAM_TOOL_RE = prefixRe(askDeniedPrefixes);
export const DENIED_HOOK_TOOL_RE = new RegExp(`^(${config.hookToolNames.join("|")})$`);
