export interface SlashSubagentDefinition {
  id: string;
  label: string;
  description: string;
  /** When true, hidden in Ask mode (Task is denied there). */
  hiddenInAsk: boolean;
}

/** Catalog aligned with Cursor Task `subagent_type` values (@cursor/sdk ^1.0.16). */
export const SLASH_SUBAGENT_CATALOG: readonly SlashSubagentDefinition[] = [
  {
    id: "explore",
    label: "explore",
    description: "コードベースを素早く読み取り専用で探索",
    hiddenInAsk: true,
  },
  {
    id: "generalPurpose",
    label: "generalPurpose",
    description: "複雑な調査やマルチステップ作業",
    hiddenInAsk: true,
  },
  {
    id: "shell",
    label: "shell",
    description: "シェルコマンドの実行とターミナル操作",
    hiddenInAsk: true,
  },
  {
    id: "code-reviewer",
    label: "code-reviewer",
    description: "変更コードの品質・セキュリティレビュー",
    hiddenInAsk: true,
  },
  {
    id: "debugger",
    label: "debugger",
    description: "エラー・テスト失敗・想定外挙動の調査",
    hiddenInAsk: true,
  },
  {
    id: "ci-investigator",
    label: "ci-investigator",
    description: "PR の失敗した CI チェックを調査",
    hiddenInAsk: true,
  },
  {
    id: "cursor-guide",
    label: "cursor-guide",
    description: "Cursor 製品の使い方ドキュメント",
    hiddenInAsk: true,
  },
  {
    id: "ci-watcher",
    label: "ci-watcher",
    description: "ブランチの CI 結果を監視",
    hiddenInAsk: true,
  },
] as const;

export function slashSubagentsForMode(mode: "ask" | "agent" | "plan"): SlashSubagentDefinition[] {
  if (mode === "ask") return [];
  return [...SLASH_SUBAGENT_CATALOG];
}
