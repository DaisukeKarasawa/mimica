import type { ChatSession, EditorContext } from "@mimica/shared";

const now = new Date().toISOString();

/** Fixed IDs so Design Mode previews stay stable across reloads. */
export const UI_LAB_SESSION_IDS = {
  impl: "ui-lab-session-impl",
  bug: "ui-lab-session-bug",
  review: "ui-lab-session-review",
  askQuestions: "ui-lab-session-ask-questions",
  mermaid: "ui-lab-session-mermaid",
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
      id: UI_LAB_SESSION_IDS.mermaid,
      title: "Mermaid 図",
      createdAt: now,
      updatedAt: now,
      workspacePath: UI_LAB_EDITOR_CONTEXT.workspacePath,
      characterId: "rio",
      messages: [
        {
          id: "ui-lab-u-mermaid",
          role: "user",
          content: "Companion と Extension の接続を図で説明して",
          createdAt: now,
        },
        {
          id: "ui-lab-a-mermaid",
          role: "assistant",
          content: [
            "localhost WebSocket でつながる構成です。",
            "",
            "```mermaid",
            "flowchart LR",
            "  ext[Cursor Extension]",
            "  ws[(WebSocket :43721)]",
            "  comp[Mimica Companion]",
            "  ext --> ws --> comp",
            "```",
            "",
            "シーケンスの例:",
            "",
            "```mermaid",
            "sequenceDiagram",
            "  participant U as User",
            "  participant C as Companion",
            "  participant A as Agent SDK",
            "  U->>C: メッセージ送信",
            "  C->>A: prompt (stream)",
            "  A-->>C: delta chunks",
            "  C-->>U: Markdown + 図",
            "```",
          ].join("\n"),
          createdAt: now,
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
  ];
}
