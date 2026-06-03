import * as vscode from "vscode";
import type { ChildProcess } from "node:child_process";
import { join } from "node:path";
import WebSocket from "ws";
import type { ClientMessage, ServerMessage } from "@mimica/shared";
import { DEFAULT_WS_PORT } from "@mimica/shared";
import { getBridgeToken } from "./bridgeToken";
import { companionLaunchHint, launchCompanion } from "./companionLaunch";
import { getEditorContext } from "./contextProvider";
import { loadRepoDotEnv } from "./loadRepoDotEnv";

loadRepoDotEnv(join(__dirname, "..", "..", ".."));

let companionProcess: ChildProcess | null = null;
let companionLaunchAttempted = false;
let wsClient: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let isShuttingDown = false;
let pendingConnect: Promise<void> | null = null;

function debounce(fn: () => void, ms: number): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn();
    }, ms);
  };
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("mimica.openCompanion", () => void openCompanion(context)),
    vscode.commands.registerCommand("mimica.askAboutSelection", () => void pushContext()),
    vscode.commands.registerCommand("mimica.askAboutCurrentFile", () => void pushContext()),
    vscode.commands.registerCommand("mimica.reloadCharacter", () => {
      void vscode.window.showInformationMessage(
        "キャラクターの再読み込みは Companion 側で行います。",
      );
    }),
    vscode.commands.registerCommand("mimica.openSettings", () => {
      void vscode.window.showInformationMessage("設定画面は今後実装予定です。");
    }),
    vscode.window.onDidChangeActiveTextEditor(debouncedPushContext),
    vscode.workspace.onDidChangeTextDocument(debouncedPushContext),
  );
}

export function deactivate(): void {
  isShuttingDown = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  pendingConnect = null;
  wsClient?.close();
  wsClient = null;
  companionLaunchAttempted = false;
  if (companionProcess) {
    killCompanionProcess(companionProcess);
    companionProcess = null;
  }
}

function killCompanionProcess(proc: ChildProcess): void {
  const { pid } = proc;
  if (pid != null && process.platform !== "win32") {
    try {
      process.kill(-pid, "SIGTERM");
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "ESRCH" && code !== "EPERM") throw err;
    }
  }
  proc.kill();
}

async function openCompanion(context: vscode.ExtensionContext): Promise<void> {
  if (!companionLaunchAttempted) {
    companionLaunchAttempted = true;
    try {
      companionProcess = launchCompanion(context);
      if (companionProcess) {
        companionProcess.on("exit", () => {
          companionProcess = null;
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      void vscode.window.showErrorMessage(`Mimica Companion を起動できません: ${message}`);
      return;
    }
    try {
      await waitForBridge();
    } catch {
      void vscode.window.showWarningMessage(
        `Companion の起動に時間がかかっています。${companionLaunchHint(context)}`,
      );
    }
  }
  try {
    await connectBridge();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    void vscode.window.showErrorMessage(`Mimica ブリッジに接続できません: ${message}`);
    return;
  }
  await pushContext();
  void vscode.window.showInformationMessage("Mimica Companion を起動しました。");
}

function waitForBridge(maxMs = 15000): Promise<void> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const ws = new WebSocket(`ws://127.0.0.1:${DEFAULT_WS_PORT}`);
      ws.once("open", () => {
        ws.close();
        resolve();
      });
      ws.once("error", () => {
        ws.close();
        if (Date.now() - started > maxMs) reject(new Error("Companion bridge timeout"));
        else setTimeout(tryConnect, 500);
      });
    };
    tryConnect();
  });
}

function handleServerMessage(raw: unknown): void {
  if (!raw || typeof raw !== "object") return;
  const msg = raw as ServerMessage;
  if (msg.type === "connection_ack") {
    /* token is never sent over WebSocket; use MIMICA_BRIDGE_TOKEN from env */
  }
}

async function connectBridge(): Promise<void> {
  if (isShuttingDown) return;
  const bridgeToken = getBridgeToken();
  if (wsClient?.readyState === WebSocket.OPEN && bridgeToken) return;
  if (pendingConnect) return pendingConnect;
  if (!bridgeToken) {
    throw new Error(
      "MIMICA_BRIDGE_TOKEN is required. Set it in the environment, repo .env (dev), or launch Companion once so ~/Library/Application Support/Mimica/bridge-token is created.",
    );
  }

  pendingConnect = (async () => {
    wsClient?.close();
    wsClient = new WebSocket(`ws://127.0.0.1:${DEFAULT_WS_PORT}`);
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Bridge auth timeout")), 5000);
      wsClient!.once("open", () => {
        /* connection_ack arrives on message */
      });
      wsClient!.once("message", (data) => {
        try {
          const parsed = JSON.parse(String(data)) as ServerMessage;
          if (parsed.type === "connection_ack") {
            clearTimeout(timeout);
            resolve();
          }
        } catch {
          /* wait for valid ack */
        }
      });
      wsClient!.once("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
    if (isShuttingDown) {
      wsClient?.close();
      wsClient = null;
      return;
    }
    wsClient.on("message", (data) => {
      try {
        handleServerMessage(JSON.parse(String(data)));
      } catch {
        /* ignore */
      }
    });
    wsClient.on("close", () => {
      if (!isShuttingDown) scheduleReconnect();
    });
    if (bridgeToken) {
      const ready: ClientMessage = { type: "companion_ready", token: bridgeToken };
      wsClient.send(JSON.stringify(ready));
    }
  })();

  try {
    await pendingConnect;
  } finally {
    pendingConnect = null;
  }
}

function scheduleReconnect(): void {
  if (isShuttingDown) return;
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void connectBridge().then(() => pushContext());
  }, 2000);
}

async function pushContext(): Promise<void> {
  if (isShuttingDown) return;
  const ctx = getEditorContext();
  if (!ctx) return;
  if (wsClient?.readyState !== WebSocket.OPEN) {
    try {
      await connectBridge();
    } catch {
      return;
    }
  }
  const bridgeToken = getBridgeToken();
  if (!bridgeToken) return;
  const msg: ClientMessage = { type: "context_update", context: ctx, token: bridgeToken };
  wsClient?.send(JSON.stringify(msg));
}

const debouncedPushContext = debounce(() => void pushContext(), 250);
