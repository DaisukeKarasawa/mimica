import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  appendEditedFile,
  extractEditedFilePath,
  isFileEditTool,
  runLogEntryFromAgentEvent,
} from "./runLog.js";

describe("isFileEditTool", () => {
  it("matches write-style tools", () => {
    assert.equal(isFileEditTool("Write"), true);
    assert.equal(isFileEditTool("StrReplace"), true);
    assert.equal(isFileEditTool("ApplyPatch"), true);
    assert.equal(isFileEditTool("EditNotebook"), true);
  });

  it("does not match read-only tools", () => {
    assert.equal(isFileEditTool("Read"), false);
    assert.equal(isFileEditTool("Grep"), false);
    assert.equal(isFileEditTool("Shell"), false);
  });
});

describe("extractEditedFilePath", () => {
  it("reads path from formatted tool detail", () => {
    assert.equal(
      extractEditedFilePath("Write", "running · apps/companion/src/App.tsx"),
      "apps/companion/src/App.tsx",
    );
  });

  it("ignores non-edit tools", () => {
    assert.equal(extractEditedFilePath("Read", "running · apps/companion/src/App.tsx"), null);
  });
});

describe("runLogEntryFromAgentEvent", () => {
  it("ignores streamed response text", () => {
    assert.equal(
      runLogEntryFromAgentEvent({
        type: "agent_delta",
        sessionId: "session-1",
        runId: "run-1",
        content: "hello",
      }),
      null,
    );
  });

  it("keeps error events for the activity log", () => {
    assert.deepEqual(
      runLogEntryFromAgentEvent({
        type: "agent_error",
        sessionId: "session-1",
        runId: "run-1",
        message: "boom",
      }),
      {
        runId: "run-1",
        kind: "error",
        label: "エラー",
        detail: "boom",
      },
    );
  });
});

describe("appendEditedFile", () => {
  it("dedupes by path and keeps newest first", () => {
    const first = appendEditedFile([], {
      path: "a.ts",
      runId: "run-1",
      toolName: "Write",
    });
    const second = appendEditedFile(first, {
      path: "b.ts",
      runId: "run-1",
      toolName: "Write",
    });
    const third = appendEditedFile(second, {
      path: "a.ts",
      runId: "run-2",
      toolName: "StrReplace",
    });

    assert.deepEqual(
      third.map((file) => file.path),
      ["a.ts", "b.ts"],
    );
    assert.equal(third[0]?.runId, "run-2");
  });
});
