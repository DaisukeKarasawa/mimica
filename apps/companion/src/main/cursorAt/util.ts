import { extname } from "node:path";

export function languageHintFromPath(relativePath: string): string {
  const ext = extname(relativePath).slice(1);
  return ext || "text";
}
