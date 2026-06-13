import { randomUUID, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { WebSocketServer, WebSocket } from "ws";
import type { ClientMessage, CodeSymbolResult, EditorContext, ServerMessage } from "@mimica/shared";
import { MIMICA_BRIDGE_TOKEN_FILENAME } from "@mimica/shared";
import { registerWorkspaceRoot } from "./workspaceAllowlist.js";
import { userDataJoin } from "./userDataPaths.js";

function bridgeTokenPath(): string {
  return userDataJoin(MIMICA_BRIDGE_TOKEN_FILENAME);
}

function resolveBridgeToken(): string {
  const fromEnv = process.env.MIMICA_BRIDGE_TOKEN?.trim();
  if (fromEnv) return fromEnv;

  const tokenPath = bridgeTokenPath();
  if (existsSync(tokenPath)) {
    const persisted = readFileSync(tokenPath, "utf8").trim();
    if (persisted) return persisted;
  }

  const generated = randomBytes(24).toString("hex");
  writeFileSync(tokenPath, `${generated}\n`, { encoding: "utf8", mode: 0o600 });
  console.warn(
    `[mimica] MIMICA_BRIDGE_TOKEN is not set; dev token written to ${tokenPath} (mode 0600). Copy it into .env so the Cursor extension can authenticate.`,
  );
  return generated;
}

function isEditorContext(value: unknown): value is EditorContext {
  if (!value || typeof value !== "object") return false;
  const ctx = value as Record<string, unknown>;
  if (typeof ctx.workspacePath !== "string" || ctx.workspacePath.length === 0) return false;
  try {
    registerWorkspaceRoot(ctx.workspacePath);
    return true;
  } catch {
    return false;
  }
}

function parseClientMessage(data: unknown, token: string): ClientMessage | null {
  if (!data || typeof data !== "object") return null;
  const msg = data as Record<string, unknown>;
  if (typeof msg.type !== "string") return null;
  if (typeof msg.token !== "string") return null;
  const providedToken = Buffer.from(msg.token, "utf8");
  const expectedToken = Buffer.from(token, "utf8");
  if (providedToken.length !== expectedToken.length) return null;
  if (!timingSafeEqual(providedToken, expectedToken)) return null;

  switch (msg.type) {
    case "ping":
      return { type: "ping", token };
    case "companion_ready":
      return { type: "companion_ready", token };
    case "context_update":
      if (!isEditorContext(msg.context)) return null;
      return { type: "context_update", context: msg.context, token };
    case "symbol_search_result": {
      if (typeof msg.requestId !== "string" || !Array.isArray(msg.symbols)) return null;
      const symbols = msg.symbols.filter(isCodeSymbolResult);
      return { type: "symbol_search_result", requestId: msg.requestId, token, symbols };
    }
    default:
      return null;
  }
}

function isCodeSymbolResult(value: unknown): value is CodeSymbolResult {
  if (!value || typeof value !== "object") return false;
  const symbol = value as Record<string, unknown>;
  return (
    typeof symbol.name === "string" &&
    typeof symbol.kind === "string" &&
    typeof symbol.filePath === "string" &&
    typeof symbol.startLine === "number" &&
    typeof symbol.endLine === "number"
  );
}

interface PendingSymbolSearch {
  resolve: (symbols: CodeSymbolResult[]) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class CursorBridgeServer {
  private wss: WebSocketServer | null = null;
  private client: WebSocket | null = null;
  private readonly pendingSymbolSearches = new Map<string, PendingSymbolSearch>();
  readonly bridgeToken: string;

  constructor(
    private readonly port: number,
    private readonly onContext: (context: EditorContext) => void,
    bridgeToken?: string,
    private readonly onClientChange?: (connected: boolean) => void,
  ) {
    this.bridgeToken = bridgeToken ?? resolveBridgeToken();
  }

  async start(): Promise<void> {
    this.wss = new WebSocketServer({ host: "127.0.0.1", port: this.port });
    this.wss.on("connection", (ws) => {
      if (this.client && this.client !== ws && this.client.readyState === WebSocket.OPEN) {
        this.client.close(1000, "replaced");
      }
      this.client = ws;
      this.onClientChange?.(true);

      const ack: ServerMessage = {
        type: "connection_ack",
        port: this.port,
      };
      ws.send(JSON.stringify(ack));

      ws.on("message", (data) => {
        try {
          const msg = parseClientMessage(JSON.parse(String(data)), this.bridgeToken);
          if (!msg) {
            ws.close(1008, "invalid message");
            return;
          }
          this.handleMessage(msg, ws);
        } catch {
          ws.close(1008, "invalid message");
        }
      });

      ws.on("close", () => {
        if (this.client === ws) {
          this.client = null;
          this.onClientChange?.(false);
        }
      });
    });
  }

  stop(): void {
    for (const pending of this.pendingSymbolSearches.values()) {
      clearTimeout(pending.timer);
      pending.resolve([]);
    }
    this.pendingSymbolSearches.clear();
    this.client?.close();
    this.wss?.close();
    this.wss = null;
    this.client = null;
  }

  hasClient(): boolean {
    return this.client?.readyState === WebSocket.OPEN;
  }

  searchSymbols(query: string, limit: number, timeoutMs = 5000): Promise<CodeSymbolResult[]> {
    if (!this.hasClient() || !query.trim()) {
      return Promise.resolve([]);
    }

    const requestId = randomUUID();
    const request: ServerMessage = {
      type: "symbol_search_request",
      requestId,
      query,
      limit,
    };

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pendingSymbolSearches.delete(requestId);
        resolve([]);
      }, timeoutMs);
      this.pendingSymbolSearches.set(requestId, { resolve, timer });
      this.client?.send(JSON.stringify(request));
    });
  }

  private handleMessage(msg: ClientMessage, ws: WebSocket): void {
    switch (msg.type) {
      case "ping": {
        const pong: ServerMessage = { type: "pong" };
        ws.send(JSON.stringify(pong));
        break;
      }
      case "context_update": {
        this.onContext(msg.context);
        const ack: ServerMessage = { type: "context_ack", context: msg.context };
        ws.send(JSON.stringify(ack));
        break;
      }
      case "symbol_search_result": {
        const pending = this.pendingSymbolSearches.get(msg.requestId);
        if (!pending) break;
        clearTimeout(pending.timer);
        this.pendingSymbolSearches.delete(msg.requestId);
        pending.resolve(msg.symbols);
        break;
      }
      case "companion_ready":
        break;
    }
  }
}
