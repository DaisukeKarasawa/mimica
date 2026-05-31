import type { ChatSession, EditorContext } from "@mimica/shared";

const now = new Date().toISOString();

/** Fixed IDs so Design Mode previews stay stable across reloads. */
export const UI_LAB_SESSION_IDS = {
  impl: "ui-lab-session-impl",
  bug: "ui-lab-session-bug",
  review: "ui-lab-session-review",
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
          content: "再現手順を教えてください。UI Lab では Agent は動きませんが、タブ UI の見た目は確認できます。",
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
          content: "`.top-actions .pill` の padding を調整する案が考えられます。Apply 後は `pnpm dev:companion` で実機も確認してください。",
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
  ];
}
