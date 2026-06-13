import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AgentQuestionPrompt } from "@mimica/shared";
import { buildAskQuestionFollowUpText, isAskQuestionToolName } from "./agentQuestionFollowUp.js";

const samplePrompt: AgentQuestionPrompt = {
  id: "q-prompt-1",
  runId: "run-1",
  title: "認証方式",
  source: "tool_call_stream",
  status: "pending",
  createdAt: "2026-06-13T00:00:00.000Z",
  questions: [
    {
      id: "q1",
      prompt: "どの認証方式を使いますか？",
      allowMultiple: false,
      options: [
        { id: "oauth", label: "OAuth" },
        { id: "jwt", label: "JWT" },
      ],
    },
    {
      id: "q2",
      prompt: "追加要件はありますか？",
      allowMultiple: true,
      options: [{ id: "mfa", label: "MFA" }],
    },
  ],
};

describe("buildAskQuestionFollowUpText", () => {
  it("formats canonical follow-up with title and answers", () => {
    const text = buildAskQuestionFollowUpText(samplePrompt, {
      questionPromptId: samplePrompt.id,
      answers: [
        { questionId: "q1", selectedOptionIds: ["jwt"] },
        { questionId: "q2", selectedOptionIds: ["mfa"], freeformText: "監査ログも" },
      ],
    });

    assert.equal(
      text,
      [
        "[AskQuestion answers]",
        "## 認証方式",
        "- Q: どの認証方式を使いますか？",
        "  A: JWT",
        "- Q: 追加要件はありますか？",
        "  A: MFA / 監査ログも",
      ].join("\n"),
    );
  });

  it("falls back to first question prompt when title is missing", () => {
    const text = buildAskQuestionFollowUpText(
      { ...samplePrompt, title: undefined },
      {
        questionPromptId: samplePrompt.id,
        answers: [{ questionId: "q1", selectedOptionIds: ["oauth"] }],
      },
    );

    assert.match(text, /^## どの認証方式を使いますか？/m);
  });
});

describe("isAskQuestionToolName", () => {
  it("matches common AskQuestion spellings", () => {
    assert.equal(isAskQuestionToolName("AskQuestion"), true);
    assert.equal(isAskQuestionToolName("ask_question"), true);
    assert.equal(isAskQuestionToolName("Ask-Question"), true);
  });

  it("rejects unrelated tools", () => {
    assert.equal(isAskQuestionToolName("Read"), false);
    assert.equal(isAskQuestionToolName(undefined), false);
  });
});
