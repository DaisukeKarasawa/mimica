#!/usr/bin/env node
/**
 * Project security hook for the mimica dev repo.
 * Gates package installs, remote fetch-to-shell, and risky MCP calls.
 * Read-only MVP guard is Companion-only (ensureReadOnlyHooks); not used here.
 */
import { readFileSync } from "node:fs";

/** Remote download piped into a shell — common malware / supply-chain vector. */
const DENY_SHELL_RE = [
  /\bcurl\s+[^\n|]*\|\s*(ba)?sh\b/i,
  /\bwget\s+[^\n|]*\|\s*(ba)?sh\b/i,
  /\b(ba)?sh\s+<\(\s*curl\b/i,
  /\b(ba)?sh\s+<\(\s*wget\b/i,
  /\beval\s+[^\n]*curl/i,
  /\bcurl[^\n]*\|\s*sudo\b/i,
];

/** Adding or pulling external packages / binaries — require human review. */
const ASK_INSTALL_SHELL_RE = [
  /\bpnpm\s+add\b/i,
  /\bpnpm\s+dlx\b/i,
  /\bnpm\s+install\b/i,
  /\bnpm\s+i(\s|$)/i,
  /\bnpx\b/i,
  /\bpip3?\s+install\b/i,
  /\bcargo\s+(add|install)\b/i,
  /\bbrew\s+install\b/i,
  /\bbun\s+add\b/i,
  /\bgo\s+install\b/i,
  /\bgem\s+install\b/i,
];

/** Network fetch of unknown artifacts — review URL before running. */
const ASK_FETCH_SHELL_RE = [/\bcurl\b/i, /\bwget\b/i, /\bfetch\b/i];

const ALLOW_INSTALL_SHELL_RE = [
  /\bpnpm\s+install(\s|$)/,
  /\bpnpm\s+i(\s|$)/,
  /\bnpm\s+ci(\s|$)/,
  /\bbun\s+install(\s|$)/,
];

const PACKAGE_REGISTRY_RE =
  /(registry\.npmjs\.org|npmjs\.com\/package|pypi\.org|crates\.io|rubygems\.org|raw\.githubusercontent\.com)/i;

const MCP_INSTALL_HINT_RE =
  /\b(install|npm\s+install|pnpm\s+add|pip\s+install|curl\s+|wget\s+|download|npx\s+)\b/i;

function readInput() {
  try {
    return JSON.parse(readFileSync(0, "utf8"));
  } catch {
    process.exit(2);
  }
}

function respond(permission, userMessage, agentMessage) {
  process.stdout.write(
    JSON.stringify({
      permission,
      ...(userMessage ? { user_message: userMessage } : {}),
      ...(agentMessage ? { agent_message: agentMessage } : {}),
    }),
  );
  process.exit(0);
}

function eventName(input) {
  if (typeof input.hook_event_name === "string" && input.hook_event_name.length > 0) {
    return input.hook_event_name;
  }
  if (typeof input.tool_name === "string") return "beforeMCPExecution";
  if (typeof input.command === "string") return "beforeShellExecution";
  return "";
}

function isAllowedInstallCommand(command) {
  const trimmed = command.trim();
  if (!ASK_INSTALL_SHELL_RE.some((re) => re.test(trimmed))) return false;
  return ALLOW_INSTALL_SHELL_RE.some((re) => re.test(trimmed));
}

function evaluateShell(command) {
  const trimmed = command.trim();
  if (!trimmed) return { permission: "allow" };

  for (const re of DENY_SHELL_RE) {
    if (re.test(trimmed)) {
      return {
        permission: "deny",
        userMessage:
          "Blocked: downloading remote content into a shell is not allowed (supply-chain / malware risk).",
        agentMessage:
          "This command pipes a remote download into a shell. Do not retry. Use a vetted package manager, pin versions, and cite the trusted source.",
      };
    }
  }

  if (isAllowedInstallCommand(trimmed)) {
    return { permission: "allow" };
  }

  if (ASK_INSTALL_SHELL_RE.some((re) => re.test(trimmed))) {
    return {
      permission: "ask",
      userMessage: `Review before installing external packages or binaries: ${trimmed}`,
      agentMessage:
        "This command may install third-party code. Confirm registry, package name, and version with the user before proceeding.",
    };
  }

  if (ASK_FETCH_SHELL_RE.some((re) => re.test(trimmed))) {
    return {
      permission: "ask",
      userMessage: `Review network fetch command: ${trimmed}`,
      agentMessage:
        "This command fetches remote content. Verify the URL and checksum/source before executing.",
    };
  }

  return { permission: "allow" };
}

function evaluateMcp(input) {
  const toolName = input.tool_name ?? "";
  const payload = JSON.stringify(input.tool_input ?? {});
  const url = typeof input.url === "string" ? input.url : "";
  const command = typeof input.command === "string" ? input.command : "";

  const blob = `${toolName} ${payload} ${url} ${command}`;

  if (PACKAGE_REGISTRY_RE.test(blob) || MCP_INSTALL_HINT_RE.test(blob)) {
    return {
      permission: "ask",
      userMessage: `Review MCP call that may install or fetch external code (${toolName || "unknown tool"}).`,
      agentMessage:
        "This MCP call may pull third-party packages or remote artifacts. Confirm scope with the user before retrying.",
    };
  }

  return { permission: "allow" };
}

const input = readInput();
const event = eventName(input);

if (event === "beforeShellExecution") {
  const command = input.command ?? "";
  const result = evaluateShell(command);
  respond(result.permission, result.userMessage, result.agentMessage);
}

if (event === "beforeMCPExecution") {
  const result = evaluateMcp(input);
  respond(result.permission, result.userMessage, result.agentMessage);
}

respond("allow");
