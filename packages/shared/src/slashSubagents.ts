export interface SlashSubagentDefinition {
  id: string;
  label: string;
  description: string;
  /** When true, hidden in Ask mode (Task is denied there). */
  hiddenInAsk: boolean;
}

/**
 * Built-in catalog aligned with Cursor Task `subagent_type` values.
 * Source: @cursor/sdk Task tool enum (Cursor IDE 2026-03) + cursor-team-kit plugin docs.
 */
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
  {
    id: "best-of-n-runner",
    label: "best-of-n-runner",
    description: "分離 worktree で best-of-N 並列実験を実行",
    hiddenInAsk: true,
  },
  {
    id: "agents-memory-updater",
    label: "agents-memory-updater",
    description: "チャット履歴から AGENTS.md を更新",
    hiddenInAsk: true,
  },
  {
    id: "thermo-nuclear-code-quality-review",
    label: "thermo-nuclear-code-quality-review",
    description: "差分に対する徹底コード品質監査",
    hiddenInAsk: true,
  },
  {
    id: "dq-alternatives-reviewer",
    label: "dq-alternatives-reviewer",
    description: "設計判断の代替案・過剰設計をレビュー",
    hiddenInAsk: true,
  },
  {
    id: "dq-feasibility-reviewer",
    label: "dq-feasibility-reviewer",
    description: "設計判断の実現可能性をレビュー",
    hiddenInAsk: true,
  },
  {
    id: "dq-frame-values-reviewer",
    label: "dq-frame-values-reviewer",
    description: "設計判断のフレーム・価値軸をレビュー",
    hiddenInAsk: true,
  },
  {
    id: "dq-quality-consistency-reviewer",
    label: "dq-quality-consistency-reviewer",
    description: "設計判断の品質・一貫性をレビュー",
    hiddenInAsk: true,
  },
  {
    id: "dq-verification-commitment-reviewer",
    label: "dq-verification-commitment-reviewer",
    description: "設計判断の検証・コミットメントをレビュー",
    hiddenInAsk: true,
  },
  {
    id: "ward-debt-domain-alignment-reviewer",
    label: "ward-debt-domain-alignment-reviewer",
    description: "ドメイン整合性の技術的負債をレビュー",
    hiddenInAsk: true,
  },
  {
    id: "ward-debt-learning-slice-reviewer",
    label: "ward-debt-learning-slice-reviewer",
    description: "学習スライスの負債リスクをレビュー",
    hiddenInAsk: true,
  },
  {
    id: "ward-debt-mindset",
    label: "ward-debt-mindset",
    description: "Ward Cunningham の負債メタファーを適用",
    hiddenInAsk: true,
  },
  {
    id: "ward-debt-repayment-scope-reviewer",
    label: "ward-debt-repayment-scope-reviewer",
    description: "リファクタが本当の負債返済かをレビュー",
    hiddenInAsk: true,
  },
] as const;

export function slashSubagentsForMode(mode: "ask" | "agent" | "plan"): SlashSubagentDefinition[] {
  if (mode === "ask") return [];
  return [...SLASH_SUBAGENT_CATALOG];
}
