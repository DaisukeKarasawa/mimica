import { join } from "node:path";
import { electron } from "./electron.js";

let cachedUserData: string | null = null;

export function getUserDataPath(): string {
  if (!cachedUserData) {
    cachedUserData = electron().app.getPath("userData");
  }
  return cachedUserData;
}

export function userDataJoin(...segments: string[]): string {
  return join(getUserDataPath(), ...segments);
}
