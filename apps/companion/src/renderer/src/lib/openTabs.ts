const STORAGE_KEY = "mimica.openTabIds";

export function loadOpenTabIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function persistOpenTabIds(ids: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}
