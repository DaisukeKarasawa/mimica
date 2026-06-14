import type { ChatSession, EditorContext } from "@mimica/shared";

const now = new Date().toISOString();

/** Fixed IDs so Design Mode previews stay stable across reloads. */
export const UI_LAB_SESSION_IDS = {
  impl: "ui-lab-session-impl",
  bug: "ui-lab-session-bug",
  review: "ui-lab-session-review",
  askQuestions: "ui-lab-session-ask-questions",
  chatOverflow: "ui-lab-session-chat-overflow",
} as const;

export const UI_LAB_EDITOR_CONTEXT: EditorContext = {
  workspacePath: "/Users/you/dev/mimica",
  currentFilePath: "/Users/you/dev/mimica/apps/companion/src/renderer/src/App.tsx",
  currentFileLanguage: "typescript",
  selectedText: "export default function App()",
  selectionStartLine: 25,
  selectionEndLine: 25,
};

export function createUiLabSampleSessions(): ChatSession[] {
  return [
    {
      id: UI_LAB_SESSION_IDS.impl,
      title: "実装相談",
      createdAt: now,
      updatedAt: now,
      workspacePath: UI_LAB_EDITOR_CONTEXT.workspacePath,
      characterId: "rio",
      messages: [
        {
          id: "ui-lab-u1",
          role: "user",
          content: "チャットパネルの余白を少し広げたい。Design Mode で触れる？",
          createdAt: now,
        },
        {
          id: "ui-lab-a1",
          role: "assistant",
          content: [
            "はい。`pnpm dev:ui-lab` で起動した URL を Cursor 内蔵ブラウザで開き、Design Mode で調整できます。",
            "",
            "見出しやリストの例:",
            "",
            "## チェック項目",
            "",
            "- `chat.css` の `.messages` 余白",
            "- `.bubble` の角丸",
            "- `.tool-card` のボーダー",
            "",
            "インライン `code` とブロック:",
            "",
            "```ts",
            "pnpm dev:ui-lab",
            "```",
            "",
            "```bash",
            "pnpm typecheck",
            "pnpm dev:companion",
            "```",
          ].join("\n"),
          createdAt: now,
          toolCalls: [
            {
              id: "ui-lab-t1",
              name: "read_file",
              detail: "apps/companion/src/renderer/src/styles/chat.css",
            },
          ],
        },
      ],
    },
    {
      id: UI_LAB_SESSION_IDS.bug,
      title: "バグ調査",
      createdAt: now,
      updatedAt: now,
      workspacePath: UI_LAB_EDITOR_CONTEXT.workspacePath,
      characterId: "rio",
      messages: [
        {
          id: "ui-lab-u2",
          role: "user",
          content: "タブを閉じたあとフォーカスがおかしいかも。",
          createdAt: now,
        },
        {
          id: "ui-lab-a2",
          role: "assistant",
          content:
            "再現手順を教えてください。UI Lab では Agent は動きませんが、タブ UI の見た目は確認できます。",
          createdAt: now,
        },
      ],
    },
    {
      id: UI_LAB_SESSION_IDS.review,
      title: "レビュー",
      createdAt: now,
      updatedAt: now,
      workspacePath: UI_LAB_EDITOR_CONTEXT.workspacePath,
      characterId: "rio",
      messages: [
        {
          id: "ui-lab-u3",
          role: "user",
          content: "TopBar の pill をもう一段コンパクトに。",
          createdAt: now,
        },
        {
          id: "ui-lab-a3",
          role: "assistant",
          content:
            "`.top-actions .pill` の padding を調整する案が考えられます。Apply 後は `pnpm dev:companion` で実機も確認してください。",
          createdAt: now,
          toolCalls: [
            {
              id: "ui-lab-t2",
              name: "grep",
              detail: "pattern: .pill",
            },
          ],
        },
      ],
    },
    {
      id: UI_LAB_SESSION_IDS.askQuestions,
      title: "Ask Questions",
      createdAt: now,
      updatedAt: now,
      workspacePath: UI_LAB_EDITOR_CONTEXT.workspacePath,
      characterId: "rio",
      messages: [
        {
          id: "ui-lab-u4",
          role: "user",
          content: "認証を追加して",
          createdAt: now,
        },
        {
          id: "ui-lab-a4",
          role: "assistant",
          content: "",
          createdAt: now,
          agentRunId: "ui-lab-run-ask",
          agentQuestion: {
            id: "ui-lab-question-1",
            runId: "ui-lab-run-ask",
            toolCallId: "ui-lab-tool-ask",
            title: "認証方式の確認",
            source: "tool_call_stream",
            status: "pending",
            createdAt: now,
            questions: [
              {
                id: "auth-method",
                prompt: "どの認証方式を使いますか？",
                allowMultiple: false,
                options: [
                  { id: "oauth", label: "OAuth 2.0" },
                  { id: "jwt", label: "JWT + refresh token" },
                  { id: "session", label: "Session cookie" },
                ],
              },
              {
                id: "extras",
                prompt: "追加で必要な要件はありますか？",
                allowMultiple: true,
                options: [
                  { id: "mfa", label: "MFA" },
                  { id: "audit", label: "監査ログ" },
                ],
              },
            ],
          },
        },
      ],
    },
    {
      id: UI_LAB_SESSION_IDS.chatOverflow,
      title: "横長コンテンツ",
      createdAt: now,
      updatedAt: now,
      workspacePath: UI_LAB_EDITOR_CONTEXT.workspacePath,
      characterId: "rio",
      messages: [
        {
          id: "ui-lab-u-overflow",
          role: "user",
          content: [
            "$ pnpm --filter @mimica/companion typecheck",
            "apps/companion/src/renderer/src/components/ChatPanel.tsx(142,7): error TS2322: Type 'string | undefined' is not assignable to type 'string'.",
            "  Property 'foo' is missing in type '{ bar: number; }' but required in type 'ExpectedShape'.",
            "    at resolveModules (/Users/you/dev/mimica/node_modules/.pnpm/typescript@5.8.3/node_modules/typescript/lib/typescript.js:very-long-path-segment-that-should-not-wrap-past-the-chat-panel-width.ts:99999:12)",
            "    at step (/Users/you/dev/mimica/apps/companion/src/renderer/src/lib/agentTransport.ts:88:5)",
            "    at Object.next (/Users/you/dev/mimica/apps/companion/src/renderer/src/lib/agentTransport.ts:42:14)",
          ].join("\n"),
          createdAt: now,
        },
        {
          id: "ui-lab-a-overflow",
          role: "assistant",
          content: [
            "型エラーの原因は `ExpectedShape` に `foo` が必須なのに、渡しているオブジェクトに含まれていないことです。",
            "",
            "比較用の広い GFM テーブル:",
            "",
            "| Endpoint | Method | Auth | Rate limit | Notes |",
            "| --- | --- | --- | --- | --- |",
            "| `/api/v1/sessions` | `GET` | Bearer | 120 req/min | List chat sessions for the active workspace |",
            "| `/api/v1/sessions/{id}/messages` | `POST` | Bearer | 30 req/min | Submit a user turn; streams assistant deltas over SSE |",
            "| `/api/v1/agent/questions/{id}/answer` | `POST` | Bearer | 60 req/min | Resume a paused run after AskQuestion UI submission |",
            "",
            "コードブロックの横スクロールも従来どおりです:",
            "",
            "```ts",
            'const payload: ExpectedShape = { bar: 1, foo: "required-field" };',
            "```",
          ].join("\n"),
          createdAt: now,
        },
      ],
    },
  ];
}
