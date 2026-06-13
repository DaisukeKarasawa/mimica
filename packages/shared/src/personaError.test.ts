import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPersonaErrorMessage,
  classifyAgentError,
  parsePersonaLinesJson,
  parsePersonaReactions,
  pickPersonaReactionLine,
} from "./personaError.js";

const SAMPLE_REACTIONS = {
  thinking: ["合理的な解を導き出すわ。"],
  success: ["結果で証明したわ。"],
  error: ["……想定外ね。再計算するわ。"],
  waiting: ["貴方の判断を待っているわ。"],
  cancelled: ["了解。中断するわ。"],
  error_by_kind: {
    auth_missing: ["……設定が足りないわね。"],
    agent_timeout: ["……応答が遅いわ。タイムアウトよ。"],
    connection: ["……接続が途切れたわ。"],
    attachment: ["……画像の処理に失敗したわ。"],
    session: ["……セッションが見つからないわ。"],
    read_only_blocked: ["……Ask モードでは書き込みは許可されないわ。"],
    agent_failed: ["……実行に失敗したわ。"],
    generic: ["……想定外ね。"],
  },
} as const;

describe("classifyAgentError", () => {
  it("classifies known raw messages", () => {
    assert.equal(classifyAgentError("CURSOR_API_KEY が設定されていません"), "auth_missing");
    assert.equal(classifyAgentError("Bridge auth timeout"), "connection");
    assert.equal(classifyAgentError("Companion bridge timeout"), "connection");
    assert.equal(classifyAgentError("request timeout after 30s"), "agent_timeout");
    assert.equal(classifyAgentError("応答がタイムアウトしました"), "agent_timeout");
    assert.equal(
      classifyAgentError('Read-only mode: ツール "Write" は MVP では利用できません'),
      "read_only_blocked",
    );
    assert.equal(classifyAgentError("Agent の実行に失敗しました"), "agent_failed");
    assert.equal(
      classifyAgentError("画像を添付するにはチャットセッションが必要です"),
      "attachment",
    );
    assert.equal(classifyAgentError("Session not found"), "session");
    assert.equal(classifyAgentError("run was cancelled"), "cancelled");
    assert.equal(classifyAgentError("something unexpected", "AbortError"), "cancelled");
    assert.equal(classifyAgentError("unknown failure"), "generic");
  });
});

describe("buildPersonaErrorMessage", () => {
  it("returns non-empty persona messages for each ErrorKind", () => {
    const kinds = [
      "agent_failed",
      "agent_timeout",
      "auth_missing",
      "connection",
      "attachment",
      "session",
      "read_only_blocked",
      "cancelled",
      "generic",
    ] as const;

    for (const kind of kinds) {
      const message = buildPersonaErrorMessage(kind, undefined, SAMPLE_REACTIONS);
      assert.ok(message.length > 0);
      assert.match(message, /\n\n/);
      assert.doesNotMatch(message, /^エラーが発生しました。$/);
    }
  });

  it("uses kind-specific intro from error_by_kind", () => {
    const message = buildPersonaErrorMessage("auth_missing", undefined, SAMPLE_REACTIONS);
    assert.match(message, /設定が足りない/);
  });

  it("includes truncated technical detail when provided", () => {
    const detail = "x".repeat(200);
    const message = buildPersonaErrorMessage("generic", detail, SAMPLE_REACTIONS);
    assert.match(message, /x{120}…/);
  });

  it("falls back safely without reactions", () => {
    const message = buildPersonaErrorMessage("auth_missing", "CURSOR_API_KEY missing");
    assert.match(message, /想定外/);
    assert.match(message, /CURSOR_API_KEY missing/);
  });
});

describe("parsePersonaReactions", () => {
  it("parses reactions from lines.json shape", () => {
    const parsed = parsePersonaLinesJson(
      JSON.stringify({
        characterId: "rio",
        reactions: SAMPLE_REACTIONS,
      }),
    );
    assert.ok(parsed);
    assert.deepEqual(parsed?.error_by_kind?.auth_missing, ["……設定が足りないわね。"]);
  });

  it("returns null for invalid or missing reactions", () => {
    assert.equal(parsePersonaLinesJson("not json"), null);
    assert.equal(parsePersonaReactions({}), null);
    assert.equal(parsePersonaReactions({ reactions: { error: [] } }), null);
  });
});

describe("pickPersonaReactionLine", () => {
  it("picks avatar state reaction lines", () => {
    assert.equal(pickPersonaReactionLine(SAMPLE_REACTIONS, "thinking"), "合理的な解を導き出すわ。");
    assert.equal(pickPersonaReactionLine(undefined, "error"), undefined);
  });
});
