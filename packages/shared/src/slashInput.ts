/** Slash token must start with alphanumeric; remainder may include spaces. */
export const SLASH_INPUT_PATTERN = /^\/([A-Za-z0-9][A-Za-z0-9_-]*)(?:\s+([\s\S]*))?$/;

/** Composer menu: `/` plus optional partial token (no trailing space yet). */
export const SLASH_MENU_OPEN_PATTERN = /^\/([A-Za-z0-9_-]*)$/;

export const SLASH_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

export interface ParsedSlashInput {
  token: string;
  remainder?: string;
}

export function parseSlashInput(input: string): ParsedSlashInput | null {
  const match = input.trim().match(SLASH_INPUT_PATTERN);
  if (!match) return null;
  return { token: match[1], remainder: match[2] };
}

export function slashMenuFilterQuery(value: string): string {
  const match = value.match(SLASH_MENU_OPEN_PATTERN);
  return match?.[1] ?? "";
}

export function isSlashMenuOpen(value: string): boolean {
  return SLASH_MENU_OPEN_PATTERN.test(value);
}
