export function toolCallName(toolCall: unknown): string | undefined {
  if (!toolCall || typeof toolCall !== "object") return undefined;
  const record = toolCall as Record<string, unknown>;
  for (const key of ["toolName", "name", "type"] as const) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}

export function isBlockedToolCallStatus(status: string | undefined): boolean {
  return status !== "completed" && status !== "error";
}
