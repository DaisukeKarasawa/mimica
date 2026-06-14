function readStringField(args: unknown, key: string): string | undefined {
  if (!args || typeof args !== "object") return undefined;
  const value = (args as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function summarizeToolArgs(name: string, args: unknown): string | undefined {
  const normalized = name.toLowerCase();
  const command = readStringField(args, "command");
  if (command) return command;

  const path =
    readStringField(args, "path") ??
    readStringField(args, "target_file") ??
    readStringField(args, "file_path");
  if (path) return path;

  const pattern = readStringField(args, "pattern") ?? readStringField(args, "query");
  if (pattern) return pattern;

  const description = readStringField(args, "description");
  if (description) return description;

  if (args && typeof args === "object") {
    const preview = JSON.stringify(args);
    if (preview.length <= 160) return preview;
    return `${preview.slice(0, 157)}…`;
  }

  if (normalized) return undefined;
  return undefined;
}

export function formatToolCallDetail(
  name: string,
  status: string | undefined,
  args?: unknown,
): string {
  const parts: string[] = [];
  if (status) parts.push(status);
  const summary = summarizeToolArgs(name, args);
  if (summary) parts.push(summary);
  return parts.join(" · ");
}
