import { existsSync } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { MIMICA_COMPANION_APP_DEFAULT_PATH } from "@mimica/shared";
import * as vscode from "vscode";

const COMPANION_EXECUTABLE = "Mimica";

export function getCompanionAppPath(): string {
  const inspected = vscode.workspace.getConfiguration("mimica").inspect<string>("companionAppPath");
  return (
    inspected?.globalValue?.trim() ||
    inspected?.defaultValue?.trim() ||
    MIMICA_COMPANION_APP_DEFAULT_PATH
  );
}

/** True when the extension runs from the mimica monorepo (Extension Development Host or linked path). */
export function isMimicaDevMonorepo(extensionPath: string): boolean {
  const repoRoot = join(extensionPath, "..", "..");
  return existsSync(join(repoRoot, "apps", "companion", "package.json"));
}

function spawnDetached(
  command: string,
  args: string[],
  options: { cwd?: string } = {},
): ChildProcess {
  // Cursor's extension host may set ELECTRON_RUN_AS_NODE=1; strip it so Electron apps start normally.
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;

  const child = spawn(command, args, {
    cwd: options.cwd,
    stdio: "ignore",
    detached: true,
    env,
  });
  child.on("error", () => {
    // Prevent uncaught 'error' events from terminating the extension host.
  });
  child.unref();
  return child;
}

function spawnDetachedAsync(
  command: string,
  args: string[],
  options: { cwd?: string } = {},
): Promise<ChildProcess> {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: "ignore",
      detached: true,
      env,
    });

    child.once("error", reject);
    child.once("spawn", () => {
      child.removeListener("error", reject);
      child.on("error", () => {});
      child.unref();
      resolve(child);
    });
  });
}

async function launchPackagedCompanion(appPath: string): Promise<ChildProcess | null> {
  if (process.platform !== "darwin") {
    throw new Error("Packaged Mimica Companion launch is supported on macOS only.");
  }

  const macBinary = join(appPath, "Contents", "MacOS", COMPANION_EXECUTABLE);
  if (existsSync(macBinary)) {
    try {
      return await spawnDetachedAsync(macBinary, []);
    } catch {
      if (existsSync(appPath)) {
        spawnDetached("open", ["-a", appPath]);
        return null;
      }
      throw new Error(`Mimica Companion not found at ${appPath}`);
    }
  }
  if (existsSync(appPath)) {
    spawnDetached("open", ["-a", appPath]);
    return null;
  }
  throw new Error(`Mimica Companion not found at ${appPath}`);
}

async function launchDevCompanion(extensionPath: string): Promise<ChildProcess> {
  const repoRoot = join(extensionPath, "..", "..");
  return spawnDetachedAsync("pnpm", ["--filter", "@mimica/companion", "dev"], { cwd: repoRoot });
}

export async function launchCompanion(
  context: vscode.ExtensionContext,
): Promise<ChildProcess | null> {
  if (isMimicaDevMonorepo(context.extensionPath)) {
    return launchDevCompanion(context.extensionPath);
  }
  return launchPackagedCompanion(getCompanionAppPath());
}

export function companionLaunchHint(context: vscode.ExtensionContext): string {
  if (isMimicaDevMonorepo(context.extensionPath)) {
    return "mimica リポジトリルートで pnpm dev:companion を実行してください。";
  }
  return `Mimica.app を ${getCompanionAppPath()} にインストールするか、設定 mimica.companionAppPath を確認してください。`;
}
