# Mimica プロジェクト開始ガイド

要件定義 v0.3（`docs/requirements.md`）とキックオフ時 Q&A に基づく、**確定方針・開始前タスク・実装順序**のまとめ。

最終更新: 2026-05-30

---

## 1. プロジェクト概要

| 項目             | 内容                                                                                                       |
| ---------------- | ---------------------------------------------------------------------------------------------------------- |
| プロダクト名     | Mimica                                                                                                     |
| 対象エディタ     | Cursor 専用                                                                                                |
| 初期キャラクター | 調月リオ                                                                                                   |
| 初期 MVP         | Phase 4 まで（Agent チャット + ストリーミング + キャンセル + コンテキスト + Avatar 連動 + セッション保存） |
| 対象 OS          | **macOS のみ**（他 OS 向けの考慮・実装は不要）                                                             |
| UI 言語          | **日本語のみ**                                                                                             |
| 配布             | なし（個人利用、素材非同梱）                                                                               |

---

## 2. 確定した技術方針

### 2.1 アーキテクチャ

```txt
Cursor Extension          Electron Companion App
  ├─ コマンド登録            ├─ React UI（Kanagawa Dragon 風）
  ├─ エディタコンテキスト取得   ├─ Chat Session Manager
  ├─ Companion 起動          ├─ Character Stage（PixiJS + Spine）
  └─ WebSocket クライアント    ├─ Agent Orchestrator（@cursor/sdk）
                             └─ ローカル永続化（userData）
```

- Extension ↔ Electron 通信: **localhost WebSocket**（初期推奨）
- Agent 実行: **Cursor SDK Local runtime + `CURSOR_API_KEY`**
- キャラクター描画: **PixiJS + Spine Runtime**
- monorepo: **pnpm + Turborepo**

### 2.2 MVP Agent 方針

| 項目             | 決定                                                                       |
| ---------------- | -------------------------------------------------------------------------- |
| デフォルトモード | **Agent**（UI で Ask / Agent / Plan 切替）                                 |
| Ask              | 読取専用（hook + ストリーム遮断）                                          |
| Agent / Plan     | Cursor SDK の `mode: "agent"` / `"plan"`（編集・シェル可）                 |
| 差分 UI          | Accept/Reject は Phase 5 以降                                              |
| ツール実行 UI    | **基本ツールカード**（`docs/ui-mock.html` 風、`read_file` 等をカード表示） |
| Avatar `waiting` | **MVP で使用**（ユーザー入力待ち・確認質問時）                             |

### 2.3 UI・表示

| 項目             | 決定                                                         |
| ---------------- | ------------------------------------------------------------ |
| レイアウト       | Character Stage 70% / Chat Panel 30%                         |
| テーマ           | Kanagawa Dragon 風（メモロビ・キャラ素材の色は上書きしない） |
| Agent 表示名     | **`Mimica - 調月リオ`**                                      |
| Agent アイコン   | 表示する（`icon.png`）                                       |
| ユーザーアイコン | 非表示                                                       |
| persona 反映     | 口調・口癖・短いリアクションのみ。技術回答本文は通常品質     |

#### 「チャット UI」とは

Cursor 標準チャットではなく、**Electron 外部ウィンドウ右側の Chat Side Panel** を指す。

```txt
┌─────────────────────────────────┬──────────────┐
│ Character Stage（左 70%）        │ Chat Panel   │  ← チャット UI
│ 調月リオ + idle/talking 等       │ （右 30%）    │
│                                 │ ・セッションタブ │
│                                 │ ・メッセージ    │
│                                 │ ・入力欄       │
└─────────────────────────────────┴──────────────┘
```

`Mimica - 調月リオ` は Agent メッセージバブル上部の表示名（`docs/ui-mock.html` の `Mimica · searching` 相当）。

### 2.4 セキュリティ方針

- **pnpm + `pnpm-lock.yaml` 固定**
- **`pnpm audit`** を CI / ローカルチェックに組み込み
- 依存は npm 公式の実績あるパッケージ中心（`electron`, `pixi.js`, `@esotericsoftware/spine-pixi`, `@cursor/sdk` 等）
- 素材・API キー・会話履歴は **Git 管理外**
- WebSocket は **localhost のみ**（外部公開しない）

### 2.5 persona pack

| 項目           | 内容                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------ |
| 元ネタ         | [ブルアカ Wiki - リオ Voices](https://bluearchive.wikiru.jp/?%E3%83%AA%E3%82%AA#Voices) のセリフ |
| セリフ取得     | **ユーザー**が wiki からテキスト取得                                                             |
| ファイル作成   | **開発側**が `SKILL.md` / `lines.json` / `style.md` を作成                                       |
| 提供タイミング | **monorepo セットアップ後**                                                                      |

---

## 3. 開始前チェックリスト（ユーザー作業）

### 3.1 開発環境

```bash
# Node.js 20 LTS 推奨
node -v   # v20.x

# pnpm
corepack enable
corepack prepare pnpm@latest --activate
pnpm -v
```

### 3.2 CURSOR_API_KEY

1. [cursor.com/settings](https://cursor.com/settings) にログイン
2. API Keys で新規キー作成
3. シェルに設定（Git には入れない）

```bash
# ~/.zshrc 等
export CURSOR_API_KEY="key_..."
```

## 3.3 Spine 素材（Phase 1）

**[docs/spine-asset-guide.md](spine-asset-guide.md)** — BA-AD ダウンロードから配置・検証までの全手順。

### 3.4 persona 用セリフ文（monorepo 後）

wiki から取得したセリフを、以下のような形式で共有する。

```txt
# カテゴリ例
- ログイン: 「…」
- ホーム: 「…」
- 絆ストーリー: 「…」
```

### 3.5 UI モック確認（任意）

`docs/ui-mock.html` をブラウザで開き、レイアウト・色味を確認する。大きな変更があれば Task 1 前に共有。

---

## 4. 実装順序（確定）

要件 §14 の Task 一覧に沿い、以下の順で進める。

| 順  | Task    | 内容                                                     | 素材要否                   |
| --- | ------- | -------------------------------------------------------- | -------------------------- |
| 1   | Task 1  | monorepo 雛形（pnpm, Turborepo, TS, lint/format, audit） | 不要                       |
| 2   | Task 2  | Electron + React + Kanagawa Dragon + UI モック移植       | 不要                       |
| 3   | Task 3  | Character Runtime 雛形（PixiJS, Spine）                  | 不要（プレースホルダー可） |
| 4   | Task 4  | アニメーション抽出 dev tool                              | 素材配置後                 |
| 5   | Task 5  | 調月リオ表示・idle・手動状態切替                         | 素材配置後                 |
| 6   | Task 6  | Chat UI（セッションタブ、バブル、アイコン等）            | 不要                       |
| 7   | Task 7  | セッション保存                                           | 不要                       |
| 8   | Task 8  | Cursor 拡張雛形 + WebSocket 通信                         | 不要                       |
| 9   | Task 9  | Cursor SDK 連携（ストリーム、キャンセル）                | API キー要                 |
| 10  | Task 10 | Agent 状態 → Avatar 状態連動                             | 素材推奨                   |

### Phase 対応

| Phase   | 状態              | 内容                               |
| ------- | ----------------- | ---------------------------------- |
| Phase 0 | ほぼ完了          | 要件定義、UI モック、方針確定      |
| Phase 1 | 次                | キャラ素材・アニメーション検証     |
| Phase 2 | —                 | 外部ウィンドウ UI                  |
| Phase 3 | —                 | Cursor 拡張・連携                  |
| Phase 4 | **初期 MVP 完了** | Agent チャット + Avatar 連動       |
| Phase 5 | 次フェーズ        | コード編集、差分、Accept/Reject 等 |

---

## 5. Agent 状態 → Avatar 状態マッピング

```txt
user submitted prompt     → thinking
agent started               → thinking
file/context read           → thinking
assistant response streaming → talking
waiting for user action     → waiting
completed                   → success → idle
cancelled                   → idle
failed                      → error → idle
```

---

## 6. 設定初期値（参考）

```json
{
  "theme": "kanagawa-dragon",
  "activeCharacterId": "rio",
  "characterAssetRoot": "~/MimicaAssets/characters/rio",
  "motionMapPath": "~/MimicaAssets/characters/rio/motion-map.json",
  "personaPackPath": "~/MimicaAssets/characters/rio/persona/SKILL.md",
  "chatIconPath": "~/MimicaAssets/characters/rio/icon.png",
  "maxChatSessions": 5,
  "saveChatHistory": true,
  "defaultAgentMode": "agent"
}
```

> 注: 要件 §12.2 では `defaultAgentMode: "ask"` だが、キックオフ Q&A で **Agent（読取専用）** に確定。

---

## 7. 実装中に開発側で決める細部

以下はキックオフ時の確認不要とし、実装時に決定する。

- WebSocket ポート番号（localhost のみ）
- セッション名の自動生成ルール（例: 最初のユーザーメッセージ先頭 N 文字）
- ウィンドウサイズ・位置の初期値（UI モック準拠）
- Avatar 状態切替のクールダウン時間

---

## 8. 開始条件

以下が揃えば **Task 1（monorepo 作成）** に着手する。

- [ ] Node.js 20 + pnpm 利用可能
- [ ] `CURSOR_API_KEY` 設定済み
- [ ] `~/MimicaAssets/characters/rio/` ディレクトリ作成済み（素材ファイル自体は Phase 1 前でも可）

---

## 9. 関連ファイル

| ファイル                  | 説明                               |
| ------------------------- | ---------------------------------- |
| `docs/requirements.md`    | 要件定義 v0.3（本体）              |
| `docs/ui-mock.html`       | UI モック                          |
| `docs/project-kickoff.md` | キックオフガイド（本ドキュメント） |

---

## 10. 次のアクション

1. **ユーザー**: Companion 起動後の Spine / Agent 動作の目視確認
2. **開発**: Phase 4 残件（persona 反映強化・設定 UI 等）は要件に沿って順次

---

## 11. 実装進捗（2026-05-30 更新）

### 完了

- Task 1–8: monorepo / Electron UI / チャット / セッション保存 / Cursor 拡張 + WebSocket
- **persona pack**: `templates/persona/` に雛形、`~/MimicaAssets/.../persona/` にセリフ本体（Git 管理外）
- **Spine 素材**: `~/MimicaAssets/characters/rio/` に配置済
  - `CH0158_home.skel` / `.atlas` / PNG ×2 / `metadata.json` / `motion-map.json`
- **BA-AD**: `~/dev/BA-AD` をソースビルド（`~/dev/BA-AD/target/release/baad`）
- **`CURSOR_API_KEY`**: 環境変数設定済（ユーザー確認）
- **Phase 1 / Task 9–10**: Spine 表示、SDK ストリーム、Avatar 連動（コード実装済・要目視確認）

### 次に着手

| 順  | 内容                                                   | 状態                                         |
| --- | ------------------------------------------------------ | -------------------------------------------- |
| 1   | **Phase 1**: PixiJS + Spine 表示・idle・手動アニメ切替 | 実装済（要 `pnpm dev:companion` で目視確認） |
| 2   | **Task 9**: Cursor SDK 連携（ストリーム・キャンセル）  | 実装済（要実機 Agent 確認）                  |
| 3   | **Task 10**: Agent 状態 → Avatar 連動                  | 実装済                                       |

### 手動確認

1. `pnpm dev:companion` → ステージに調月リオ表示、下部ボタンでアニメ切替
2. チャット送信 → Cursor SDK ストリーミング（`CURSOR_API_KEY` 必須）
3. `pnpm --filter @mimica/character-runtime extract-animations -- ~/MimicaAssets/characters/rio/CH0158_home.skel`

### ローカル環境メモ（Git 管理外）

| 項目           | パス / 値                              |
| -------------- | -------------------------------------- |
| Spine 素材     | `~/MimicaAssets/characters/rio/`       |
| BA-AD          | `~/dev/BA-AD/target/release/baad`      |
| API キー       | 環境変数 `CURSOR_API_KEY`              |
| 一時 DL データ | `~/Downloads/mimica-ba-rio/`（削除可） |

### 起動方法

```bash
pnpm install
pnpm dev:companion          # Companion 単体
pnpm dev:extension          # 拡張 watch
# Cursor: F5 → Mimica: Open Companion
```
