import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  agentRunError,
  parsePersonaFormatRequest,
  PersonaFacingError,
  toPersonaUserMessage,
} from "./personaErrors.js";

describe("parsePersonaFormatRequest", () => {
  it("accepts known kinds with optional string detail", () => {
    assert.deepEqual(parsePersonaFormatRequest("connection"), agentRunError("connection"));
    assert.deepEqual(
      parsePersonaFormatRequest("attachment", "too large"),
      agentRunError("attachment", "too large"),
    );
  });

  it("rejects unknown kinds and non-string detail", () => {
    assert.equal(parsePersonaFormatRequest("not_a_kind"), null);
    assert.equal(parsePersonaFormatRequest("connection", 42), null);
    assert.equal(parsePersonaFormatRequest(null), null);
  });
});

describe("toPersonaUserMessage", () => {
  it("formats PersonaFacingError for IPC responses", () => {
    const message = toPersonaUserMessage(new PersonaFacingError(agentRunError("session")));
    assert.match(message, /セッション/);
    assert.match(message, /\n\n/);
  });
});
