import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ChatSession } from "@mimica/shared";
import { formatPastChatForPrompt, listPastChatMenuItems } from "./pastChats.js";

const session: ChatSession = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Auth refactor",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  workspacePath: "/tmp/workspace",
  characterId: "rio",
  messages: [
    { id: "1", role: "user", content: "Help with auth", createdAt: "2026-01-01T00:00:00.000Z" },
    { id: "2", role: "assistant", content: "Sure", createdAt: "2026-01-01T00:01:00.000Z" },
  ],
};

describe("listPastChatMenuItems", () => {
  it("filters by workspace and excludes current session", () => {
    const items = listPastChatMenuItems([session], "/tmp/workspace", session.id, "");
    assert.equal(items.length, 0);

    const visible = listPastChatMenuItems([session], "/tmp/workspace", "other-session", "");
    assert.equal(visible.length, 1);
    assert.equal(visible[0]?.kind, "past-chat");
    assert.equal(visible[0]?.path, session.id);
  });
});

describe("formatPastChatForPrompt", () => {
  it("includes recent turns", () => {
    const result = formatPastChatForPrompt(session);
    assert.match(result.text, /Referenced past chat/);
    assert.match(result.text, /Help with auth/);
    assert.match(result.text, /Sure/);
  });
});
