import { electron } from "./electron.js";

const HTTP_URL = /^https?:\/\//i;

export async function openAllowedExternalUrl(url: string): Promise<boolean> {
  if (!HTTP_URL.test(url)) return false;
  await electron().shell.openExternal(url);
  return true;
}
