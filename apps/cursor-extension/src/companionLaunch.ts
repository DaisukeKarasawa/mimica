import { existsSync } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import * as vscode from "vscode";

const DEFAULT_COMPANION_APP_PATH = "/Applications/Mimica.app";
const COMPANION_EXECUTABLE = "Mimica";

export function getCompanionAppPath(): string {
  return (
    vscode.workspace.getConfiguration("mimica").get<string>("companionAppPath")?.trim() ||
    DEFAULT_COMPANION_APP_PATH
  );
}

/** True when the extension runs from the mimica monorepo (Extension Development Host or linked path). */
export function isMimicaDevMonorepo(extensionPath: string): boolean {
  const repoRoot = join(extensionPath, "..", "..");
  return existsSync(join(repoRoot, "apps", "companion", "package.json"));
}

function spawnDetached(command: string, args: string[], options: { cwd?: string } = {}): ChildProcess {
  const child = spawn(command, args, {
    cwd: options.cwd,
    stdio: "ignore",
    detached: true,
    env: process.env,
  });
  child.unref();
  return child;
}

function launchPackagedCompanion(appPath: string): ChildProcess | null {
  const macBinary = join(appPath, "Contents", "MacOS", COMPANION_EXECUTABLE);
  if (process.platform === "darwin") {
    if (existsSync(macBinary)) {
      return spawnDetached(macBinary, []);
    }
    if (existsSync(appPath)) {
      spawnDetached("open", ["-a", appPath]);
      return null;
    }
    return null;
  }

  if (process.platform === "win32" && existsSync(appPath)) {
    return spawnDetached(appPath, []);
  }

  if (process.platform === "linux" && existsSync(appPath)) {
    return spawnDetached(appPath, []);
  }

  return null;
}

function launchDevCompanion(extensionPath: string): ChildProcess {
  const repoRoot = join(extensionPath, "..", "..");
  return spawnDetached("pnpm", ["--filter", "@mimica/companion", "dev"], { cwd: repoRoot });
}

export function launchCompanion(context: vscode.ExtensionContext): ChildProcess | null {
  if (isMimicaDevMonorepo(context.extensionPath)) {
    return launchDevCompanion(context.extensionPath);
  }

  const appPath = getCompanionAppPath();
  const macBinary = join(appPath, "Contents", "MacOS", COMPANION_EXECUTABLE);
  if (process.platform === "darwin") {
    if (existsSync(macBinary)) {
      return spawnDetached(macBinary, []);
    }
    if (existsSync(appPath)) {
      spawnDetached("open", ["-a", appPath]);
      return null;
    }
    throw new Error(`Mimica Companion not found at ${appPath}`);
  }

  const packaged = launchPackagedCompanion(appPath);
  if (packaged === null) {
    throw new Error(`Mimica Companion not found at ${appPath}`);
  }
  return packaged;
}

export function companionLaunchHint(context: vscode.ExtensionContext): string {
  if (isMimicaDevMonorepo(context.extensionPath)) {
    return "別ターミナルで pnpm dev:companion を実行してください。";
  }
  return `Mimica.app を ${getCompanionAppPath()} にインストールするか、設定 mimica.companionAppPath を確認してください。`;
}
