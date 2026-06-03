# Mimica 要件定義 v0.3

## 0. 概要

**Mimica** は、Cursor 上の開発体験を、キャラクターエージェントとの会話体験として再構成する個人利用向けアプリケーションである。

Cursor の標準チャットを将来的に置き換えることを目標としつつ、初期MVPでは「外部ウィンドウ上のキャラクター表示」「Agentチャット」「回答ストリーミング」「キャラクター状態連動」までを優先する。

---

# 1. 確定事項

## 1.1 プロダクト名

```txt
Mimica
```

## 1.2 対象エディタ

```txt
Cursor 専用
```

VS Code 汎用対応は対象外とする。

理由:

- Cursor標準チャットの置き換えを目標にするため
- Cursor SDK / Cursor Agent 連携を前提にするため
- VS Code互換性を考慮すると、Cursor固有機能を使いにくくなるため

## 1.3 初期キャラクター

```txt
調月リオ
```

初期キャラクターは調月リオで確定する。

## 1.4 UI方針

```txt
外部ウィンドウ + 右サイドチャット + Kanagawa Dragon風テーマ
```

基本レイアウト:

- 左/中央: メモロビ・キャラクター表示領域を大きく取る
- 右: LINE/Slack風チャットサイドパネル
- キャラクターは外部ウィンドウ表示中は常時表示
- チャットしていない間もidleモーションで軽く動く
- メモロビ素材の色は上書きしない
- メモロビ以外のUI外装はKanagawa Dragon風にする

## 1.5 会話履歴

```txt
各チャットセッション単位で保存する
```

個人利用のため、プライバシー配慮による保存制限は不要とする。

## 1.6 persona pack の強さ

```txt
技術回答は普通に行い、口調や短い口癖だけキャラクター性を反映する
```

方針:

- 技術説明は正確性・可読性を優先する
- 過度なロールプレイは避ける
- 口調、呼び方、短い相槌、成功/失敗時のリアクションでキャラクター性を出す
- persona pack は毎回参照するが、回答品質を阻害しないようにする

---

# 2. プロダクトコンセプト

## 2.1 目的

Cursorでの開発中に、標準チャットではなく、キャラクターと会話しながら開発できる体験を作る。

理想の状態:

```txt
コードを書く
↓
Mimicaのキャラクターに相談する
↓
裏側ではCursor Agentがコードベースを読む・考える・回答する
↓
Agentの状態に応じてキャラクターが動く
↓
回答中は話しているように見える
↓
成功・失敗・考え中・確認待ちなどが視覚的に分かる
```

## 2.2 最終的な体験目標

将来的には、Cursor標準チャットを使わずに、Mimica上で以下を完結できる状態を目指す。

- 質問回答
- コード理解
- コードレビュー
- 実装相談
- コード編集
- 複数ファイル編集
- 差分確認
- Accept/Reject
- ターミナル実行
- テスト実行
- エラー解析
- 複数チャットスレッド
- Rules / Skills / MCP / persona pack の活用

ただし、初期MVPではすべてを一度に実装しない。

---

# 3. スコープ方針

## 3.1 初期MVPの範囲

初期MVPでは、以下を実装対象とする。

```txt
- 外部ウィンドウUI
- 調月リオのキャラクター表示
- idleモーション常時再生
- 回答中talking/代替モーション
- Cursor Agentとのチャット
- 回答ストリーミング表示
- 実行中キャンセル
- 現在ファイル/選択範囲コンテキスト
- Agent状態に応じたキャラクター状態連動
- チャットセッション単位の履歴保存
- LINE/Slack風チャットUI
- Agent側のみキャラクターアイコン表示
- ユーザー側アイコン非表示
- Kanagawa Dragon風UIテーマ
```

## 3.2 初期MVPでは後回しにするもの

以下は初期MVPの次フェーズ以降で扱う。

```txt
- コード編集
- 差分表示
- Accept/Reject
- ターミナル実行
- テスト実行
- 複数ファイル編集
- MCP連携の高度な表示
- 複数キャラクター切り替え
- 設定画面の完全実装
```

## 3.3 明示的に対象外とするもの

```txt
- VS Code汎用対応
- 音声入力
- 音声合成
- 実音声再生
- 素材の配布
- Marketplace公開
- 商用利用
- チーム利用
- 独自エディタのフル実装
- LSPの自作
- ファイルツリーの完全自作
- Git UIの完全自作
```

---

# 4. フェーズ定義

## Phase 0: UIモック・要件確定

目的:

- Mimicaの体験イメージを固める
- UIの方向性を確認する
- 開発に必要な仕様を整理する

成果物:

- 要件定義
- HTML UIモック
- Kanagawa Dragon風テーマ方針
- 調月リオ前提のキャラクター要件

完了条件:

- Mimica名称が確定している
- 初期キャラクターが調月リオで確定している
- UI方向性が確定している
- 初期MVPと次フェーズの境界が確定している

現在の状態:

```txt
ほぼ完了
```

---

## Phase 1: キャラクター素材・アニメーション検証

目的:

- 調月リオ素材を読み込めるようにする
- アニメーション一覧を抽出する
- Mimica用のmotion-mapを作る

実装対象:

- ローカルアセットディレクトリ構成
- Spineアセット読み込み
- アニメーション一覧抽出dev tool
- `motion-map.json` 初期案
- idle再生
- thinking/talking/success/error/waiting の手動切替

想定アセット構成:

```txt
~/MimicaAssets/
└─ characters/
   └─ rio/
      ├─ CH0158_home.skel
      ├─ CH0158_home.atlas
      ├─ textures/
      ├─ icon.png
      ├─ metadata.json
      ├─ motion-map.json
      └─ persona/
         ├─ SKILL.md
         ├─ lines.json
         └─ style.md
```

初期motion-map対象状態:

```ts
type AvatarState = "idle" | "thinking" | "talking" | "success" | "error" | "waiting" | "cancelled";
```

暫定motion-map:

```json
{
  "idle": {
    "loop": true,
    "animations": ["Idle_01"]
  },
  "thinking": {
    "loop": true,
    "animations": ["Look_01_M"],
    "fallback": ["Idle_01"]
  },
  "waiting": {
    "loop": true,
    "animations": ["LookEnd_01_M"],
    "fallback": ["Idle_01"]
  },
  "talking": {
    "loop": true,
    "animations": [
      "CH0158_MemorialLobby_5_1",
      "CH0158_MemorialLobby_5_2",
      "CH0158_MemorialLobby_5_3"
    ],
    "fallback": ["Look_01_M", "Idle_01"]
  },
  "success": {
    "loop": false,
    "animations": ["Pat_01_A", "PatEnd_01_A"],
    "returnTo": "idle"
  },
  "error": {
    "loop": false,
    "animations": ["LookEnd_01_A"],
    "returnTo": "idle"
  }
}
```

確認すべきこと:

- `CH0158_MemorialLobby_5_*` がtalking用途に使えるか
- 常時 idle は `Idle_01`（`Start_Idle_*` は画面移動ありのため非推奨）
- ランタイムの idle/talk ランダムプール（`motionPools.isBlockedAnimation`）は **`Start_Idle_*` 名前空間全体**を除外する。`Start_Idle_01` だけでなく将来追加される同系クリップもループ候補に入れない
- `Pat_01_*` がsuccess/reactionに適しているか
- `Look_01_M` がthinkingに適しているか
- 明示的なTalk系アニメーションが存在するか

完了条件:

- 調月リオが外部UI上に表示できる
- idleが自然にループする
- 回答中に使えるtalking相当モーションが決まっている
- motion-mapが初版として成立している

---

## Phase 2: 外部ウィンドウUI実装

目的:

- Mimicaの外部ウィンドウを実装する
- キャラクター表示とチャットUIを同一画面に配置する

推奨方式:

```txt
Electron Companion App
```

理由:

- 外部ウィンドウ制御がしやすい
- PixiJS / Spine Runtime と相性が良い
- UIを大きく使える
- 将来的に透明/常時最前面などに拡張しやすい

初期UI構成:

```txt
┌──────────────────────────────────────────────────────────────┐
│ Header                                                       │
├─────────────────────────────────────────┬────────────────────┤
│ Character Stage                          │ Chat Side Panel    │
│                                         │                    │
│ - メモロビ背景                          │ - スレッド一覧      │
│ - 調月リオ                               │ - チャットログ      │
│ - idle/talking/thinking animation         │ - 入力欄            │
│ - Agent status badge                     │ - Cancel button     │
│                                         │                    │
└─────────────────────────────────────────┴────────────────────┘
```

面積配分:

```txt
Character Stage: 70%
Chat Side Panel: 30%
```

UIテーマ:

```txt
Kanagawa Dragon風
```

チャットUI要件:

- LINE/Slack風 + **Chrome 風タブ・履歴・コンポーザー**（詳細は §7.2.2 / §7.3.1）
- Agent側のみキャラクターアイコン表示
- ユーザー側アイコン非表示
- Markdown表示
- コードブロック表示
- ストリーム待ちは Thinking インジケータ（旧モックの実行中バーは §7.3.2）
- コンポーザーからキャンセル
- セッション切り替え（タブ + 履歴パネル）
- ツールカード・コンテキストチップの **パネル表示は §7.3.1 では出さない**（データ記録のみ）

完了条件:

- Electron外部ウィンドウが起動する
- キャラクター領域とチャット領域が表示される
- Kanagawa Dragon風テーマが適用される
- Agent側アイコンが表示される
- ユーザー側アイコンが表示されない
- チャットセッションUIが存在する

---

## Phase 3: Cursor拡張・外部UI連携

目的:

- CursorからMimica外部ウィンドウを起動する
- CursorのコンテキストをMimicaへ渡す

構成:

```txt
Cursor Extension
  ├─ コマンド登録
  ├─ workspace取得
  ├─ active editor取得
  ├─ selection取得
  ├─ Electron起動
  └─ Electronとの通信

Electron Companion App
  ├─ UI表示
  ├─ チャット管理
  ├─ キャラクター表示
  └─ Agent Orchestratorとの通信
```

通信方式候補:

### 候補A: localhost WebSocket

メリット:

- 双方向通信が自然
- Extension/Electron間で扱いやすい
- ログや再接続を実装しやすい

デメリット:

- ポート管理が必要
- セキュリティ設計が必要

### 候補B: IPC / child process stdio

メリット:

- ローカルプロセス間通信として閉じやすい
- ポート不要

デメリット:

- 実装がやや面倒
- デバッグしづらい可能性がある

推奨:

```txt
初期は localhost WebSocket
```

理由:

- MVPで実装しやすい
- 状態同期が分かりやすい
- 将来的な拡張にも対応しやすい

Cursor拡張コマンド:

```txt
Mimica: Open Companion
Mimica: Ask About Selection
Mimica: Ask About Current File
Mimica: Reload Character
Mimica: Open Settings
```

完了条件:

- CursorコマンドからMimicaが開く
- 現在workspaceがMimicaへ渡る
- 現在ファイルがMimicaへ渡る
- 選択範囲がMimicaへ渡る
- コンテキストは Agent 送信に付与（**パネル上のチップ表示は §7.3.1 では出さない**）

---

## Phase 4: Agentチャット + キャラクター連動 MVP

目的:

- Cursor Agentと会話できる
- Agent状態に応じて調月リオが動く
- 初期MVPとして日常利用できる最低限の体験を作る

実装対象:

- Cursor SDK連携
- Agentチャット送信
- ストリーミング回答表示
- 実行中キャンセル
- 現在ファイル/選択範囲コンテキスト送信
- チャットセッション保存
- セッション切り替え
- AgentイベントからAvatarStateへの変換
- 回答中talkingモーション
- 完了時successモーション
- エラー時errorモーション
- thinking/searching時thinkingモーション

Agent状態マッピング:

```txt
user submitted prompt
→ thinking

agent started
→ thinking

file/context read
→ thinking

assistant response streaming
→ talking

waiting for user action
→ waiting

completed
→ success → idle

cancelled
→ idle

failed
→ error → idle
```

初期チャットセッション要件:

- セッション単位で履歴保存
- セッション新規作成
- セッション切り替え
- セッション削除
- セッション名自動生成または手動変更
- 初期最大セッション数: 5

保存対象:

```ts
type ChatSession = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  workspacePath: string;
  characterId: "rio";
  messages: ChatMessage[];
};
```

```ts
type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  context?: MessageContext;
  agentRunId?: string;
};
```

完了条件:

- MimicaからAgentに質問できる
- 回答がストリーミング表示される
- 回答中に調月リオがtalking状態になる
- 完了時にsuccess/idleへ戻る
- エラー時にerror/idleへ戻る
- 実行中キャンセルできる
- 現在ファイル/選択範囲を文脈に含められる
- セッション単位で会話履歴が保存される

このPhase 4までを **初期MVP** とする。

---

## Phase 5: Cursor標準チャット置き換え機能

目的:

- Cursor標準チャットの主要機能をMimica側に取り込む

実装対象:

- コード編集
- 複数ファイル編集
- 差分表示
- Accept/Reject
- ターミナルコマンド実行
- テスト実行
- コマンド結果表示
- エラー解析
- 変更履歴表示
- Review/Fix/Planなどの実行モード

重要要件:

- 変更は初期状態では確認付き適用
- 自動適用は設定で後から許可
- 危険操作は確認必須
- 差分は読みやすく表示する
- 変更対象ファイルを明示する

完了条件:

- Mimica上でコード編集依頼ができる
- 変更差分を確認できる
- Accept/Rejectができる
- ターミナル実行結果を確認できる
- Cursor標準チャットの代替として使える場面が増える

---

# 5. システム構成

## 5.1 推奨構成

```txt
Cursor Extension
  ├─ Editor Context Provider
  ├─ Command Provider
  ├─ Companion Launcher
  └─ Communication Client

Electron Companion App
  ├─ React UI
  ├─ Chat Session Manager
  ├─ Character Stage
  ├─ Character Runtime
  ├─ Agent Orchestrator
  └─ Local Persistence

Character Runtime
  ├─ PixiJS
  ├─ Spine Runtime
  ├─ AnimationController
  └─ CharacterDirector

Agent Orchestrator
  ├─ Cursor SDK Wrapper
  ├─ Stream Handler
  ├─ Cancellation Handler
  ├─ Context Builder
  └─ Avatar Event Mapper
```

## 5.2 責務分離

### Cursor Extension

責務:

- Cursorコマンド登録
- 現在workspace取得
- 現在ファイル取得
- 選択範囲取得
- Mimica外部ウィンドウ起動
- Mimicaとの通信

責務外:

- キャラクター描画
- チャットUI描画
- 長期的なセッション管理
- Spineアセット制御

### Electron Companion App

責務:

- 外部ウィンドウ表示
- UI描画
- チャットセッション管理
- Agent実行
- キャラクター表示
- ローカル保存

### Character Runtime

責務:

- Spine読み込み
- アニメーション一覧抽出
- motion-map解釈
- アニメーション再生
- 状態遷移制御
- fallback制御

### Agent Orchestrator

責務:

- Cursor SDK実行
- Agentストリーム処理
- キャンセル処理
- AgentイベントからAvatarStateへの変換
- チャットメッセージ生成
- コンテキスト構築

---

# 6. ディレクトリ構成案

```txt
mimica/
├─ apps/
│  ├─ cursor-extension/
│  │  ├─ src/
│  │  │  ├─ extension.ts
│  │  │  ├─ commands.ts
│  │  │  ├─ contextProvider.ts
│  │  │  ├─ companionLauncher.ts
│  │  │  └─ transport.ts
│  │  └─ package.json
│  │
│  └─ companion/
│     ├─ src/
│     │  ├─ main/
│     │  │  ├─ main.ts
│     │  │  └─ window.ts
│     │  └─ renderer/
│     │     ├─ App.tsx
│     │     ├─ components/
│     │     ├─ features/chat/
│     │     ├─ features/character/
│     │     ├─ features/agent/
│     │     └─ styles/
│     └─ package.json
│
├─ packages/
│  ├─ character-runtime/
│  │  ├─ src/SpineCharacter.ts
│  │  ├─ src/AnimationController.ts
│  │  ├─ src/CharacterDirector.ts
│  │  ├─ src/extractAnimations.ts
│  │  └─ src/types.ts
│  │
│  ├─ agent-orchestrator/
│  │  ├─ src/cursorAgent.ts
│  │  ├─ src/contextBuilder.ts
│  │  ├─ src/eventMapper.ts
│  │  └─ src/types.ts
│  │
│  ├─ shared/
│  │  ├─ src/protocol.ts
│  │  ├─ src/chat.ts
│  │  ├─ src/avatar.ts
│  │  └─ src/settings.ts
│  │
│  └─ ui/
│     ├─ src/theme.ts
│     └─ src/components/
│
├─ docs/
│  ├─ requirements.md
│  ├─ architecture.md
│  ├─ motion-map.md
│  └─ asset-setup.md
│
└─ package.json
```

---

# 7. UI要件

## 7.1 外部ウィンドウ

- Electronで表示する
- Cursorから起動できる
- 閉じても再起動できる
- ウィンドウサイズを保存する
- 最小サイズを持つ

## 7.2 レイアウト

### 7.2.1 参照モデル（`docs/ui-mock.html`）

初期モックに記載したフルシェル。接続状態・コンテキストチップ・Stage バッジ等を含む。**現行 MVP の受け入れ基準は §7.2.2 / §7.3.1**。本節は参照モデルのみ。

```txt
Header
  - Mimicaロゴ
  - Cursor接続状態
  - Agentモード
  - テーマ表示

Character Stage
  - メモロビ背景
  - 調月リオ表示
  - 状態バッジ
  - 現在のAgent状態テキスト

Chat Side Panel
  - セッションタブ
  - コンテキストチップ
  - メッセージ一覧
  - 実行中バー
  - 入力欄
```

### 7.2.2 現行実装（Companion Chrome 風シェル）

**確定 UI** は次のミニマル構成とする（`pnpm dev:ui-lab` / Electron 共通）。

```txt
Header（TopBar）
  - Mimicaロゴのみ

MainSplitLayout（ドラッグで幅変更、--chat-panel-width を永続化）
  Character Stage
    - メモロビ背景 + Spine（idle/talking 等は director 連動）
    - 状態バッジ・状態テキストは出さない
  Chat Side Panel
    - Chrome 風タブバー（D&D、⌘T/W、⌘⌥←→、Ctrl+Tab）
    - メッセージ一覧 + Thinking インジケータ（ストリーム待ち）
    - コンポーザー（モードは Shift+Tab、ストリーム中はキャンセル）
    - 履歴パネル（⌘Y、↑↓/Enter、⌘F で検索フォーカス）
```

意図的に **現行スコープ外** とする項目: Header の接続状態・モード表示、コンテキストチップ、Stage 上の Agent 文言、メッセージ内の実行中バー。`editorContext` の取得と Agent 送信への付与は維持する。

## 7.3 チャット表示

### 7.3.1 現行（Chrome 風シェル）

| 項目                      | 方針                                                                                                                                                                                                                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| アイコン                  | Agent 側のみ（`icon.png`）。ユーザー側は非表示                                                                                                                                                                                                                                |
| 表示名                    | チャットヘッダに `調月リオ`（`AGENT_DISPLAY_NAME`）。バブル内の名前行・小さな状態テキストは出さない                                                                                                                                                                           |
| Markdown / コードブロック | 読みやすく表示する                                                                                                                                                                                                                                                            |
| ストリーム待ち            | `ThinkingIndicator`（内容のない assistant 行は一覧に出さない）                                                                                                                                                                                                                |
| **ツール実行 UI**         | `agent_tool` → `ChatMessage.toolCalls` に蓄積し永続化可能。**チャットパネルではカード表示しない**（ミニマルシェル）。カード化の参照は `docs/ui-mock.html`、実装は後続スライス                                                                                                 |
| **コンテキスト参照 UI**   | チップ表示しない。送信時の `editorContext` / `MessageContext` は維持                                                                                                                                                                                                          |
| **UI 言語**               | **二層**: プロダクト・案内・aria は **日本語**（例: 空タブ案内、調月リオ）。Chrome 風 chrome は **英語** — `DEFAULT_SESSION_TITLE`（`New Chat`）、履歴 `Search sessions…` / `Today`・`Yesterday`・`Earlier`、コンポーザー placeholder（`Ask Rio…` 等、`AGENT_SHORT_NAME_EN`） |

セッション（draft）:

- 初回 user 送信までは **draft**（メモリのみ。空 JSON は起動時に削除）
- `maxChatSessions` は **永続履歴の上限** と **インメモリ空 draft タブの上限** の両方に使用

開発用 **UI Lab**: `docs/ui-design-browser.md`。Design Mode で CSS/React を調整し、Electron で Agent・Spine を確認する。

### 7.3.2 将来（モック寄せ）

`docs/ui-mock.html` に沿った拡張。Phase 4 完了判定やレビューで必要になったタイミングで個別に着手する。

- Agentメッセージバブル内の表示名・状態の小表示
- ツール実行 / コンテキスト参照の **カード表示**
- Header の接続状態・Agent モード・テーマ表示
- 実行中バー（現行は Thinking + コンポーザー cancel で代替）

## 7.4 テーマ

アプリ外装はKanagawa Dragon風にする。

対象:

- 背景
- トップバー
- チャットパネル
- 入力欄
- バブル
- ボタン
- ステータスカード
- スレッドタブ

非対象:

- メモロビ背景
- キャラクター素材
- Spineアニメーション内の色

---

# 8. キャラクター要件

## 8.1 素材方式

初期はブルアカ系Spine素材を使う。

想定形式:

```txt
.skel
.atlas
.png textures
```

## 8.2 キャラクター表示

- PixiJS + Spine Runtimeで表示する
- 背景込みで表示する
- 素材の表示範囲を基本的にそのまま使う
- キャラクターの色や背景色はUIテーマで上書きしない

## 8.3 状態制御

初期AvatarState:

```ts
type AvatarState = "idle" | "thinking" | "talking" | "success" | "error" | "waiting" | "cancelled";
```

## 8.4 状態遷移

```txt
idle
  ↓ user sends message
thinking
  ↓ assistant starts streaming
talking
  ↓ completed
success
  ↓ after short duration
idle
```

```txt
thinking/talking
  ↓ cancelled
idle
```

```txt
thinking/talking
  ↓ failed
error
  ↓ after short duration
idle
```

## 8.5 アニメーション制御

要件:

- motion-mapに存在しない状態はidleへfallbackする
- 1回再生モーション後はreturnToへ戻る
- 状態切替にクールダウンを設ける（**`idle` への復帰要求はクールダウンをバイパス**し、cancel/failed/success 後の idle 復帰を確実にする）
- 回答中は頻繁に状態を切り替えない
- talking状態は回答ストリーミング中に継続する

---

# 9. Agent要件

## 9.1 初期MVP Agent機能

```txt
- チャット送信
- ストリーミング回答
- キャンセル
- 現在ファイルコンテキスト
- 選択範囲コンテキスト
- セッション継続
```

## 9.2 次フェーズ Agent機能

```txt
- コード編集
- 複数ファイル編集
- 差分生成
- 差分確認
- Accept/Reject
- ターミナル実行
- テスト実行
- エラー解析
- Review/Fix/Planモード
```

## 9.3 コンテキスト

初期MVPで扱うコンテキスト:

- workspace path
- current file path
- current file language
- selected text
- selected range
- active editor metadata
- chat session history
- persona pack

---

# 10. Persona Pack 要件

## 10.1 方針

調月リオのセリフ集をもとに、口調・呼び方・短いリアクションを定義する。

ただし、技術回答の本文は普通に行う。

## 10.2 構成

```txt
persona/
├─ SKILL.md
├─ lines.json
├─ style.md
└─ examples.md
```

## 10.3 反映方針

反映するもの:

- 口調
- 呼び方
- 短い相槌
- 成功時の一言
- エラー時の一言
- 考え中のステータス文

反映しすぎないもの:

- 長い技術説明文
- コードレビュー本文
- エラー原因説明
- 修正手順

## 10.4 回答形式

推奨:

```txt
短いキャラらしい導入
↓
通常の技術回答
↓
必要に応じて短い締めの一言
```

---

# 11. チャットセッション保存要件

## 11.1 保存単位

各チャットセッション単位で保存する。

## 11.2 保存対象

```txt
- session id
- session title
- createdAt
- updatedAt
- workspacePath
- characterId
- messages
- context metadata
- agent run metadata
```

## 11.3 保存場所

初期案:

```txt
Electron app userData配下
```

例:

```txt
~/Library/Application Support/Mimica/sessions/
```

OSごとの保存パスはElectronの `app.getPath("userData")` を使う。

## 11.4 セッション数

初期上限:

```txt
5
```

将来的には設定で変更できるようにする。

---

# 12. 設定要件

## 12.1 初期設定項目

```txt
- characterAssetRoot
- activeCharacterId
- motionMapPath
- personaPackPath
- chatIconPath
- maxChatSessions
- theme
- window size
- window position
- defaultAgentMode
- saveChatHistory
```

## 12.2 初期設定例

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
  "defaultAgentMode": "ask"
}
```

---

# 13. 非機能要件

## 13.1 パフォーマンス

- Cursor本体の操作を重くしない
- Electron側で描画負荷を閉じる
- idle時のFPSを制御できる
- Agent応答中もUIを固めない
- アセット読み込み時はローディングを表示する

## 13.2 安定性

- Electronが落ちてもCursor拡張は落ちない
- Cursor拡張が再起動しても再接続できる
- アセット読み込み失敗時はチャットUIだけ使える
- motion-mapの指定が誤っていてもfallbackする
- Agentエラー時もセッション履歴は壊れない

## 13.3 個人利用前提

- 素材はローカルに置く
- 素材をGit管理しない（公開 `mimica` リポジトリ・公開 Release には Spine バイナリを載せない）
- プライベートビルドの Companion（タグ付き GitHub Release の DMG）には、`mimica-assets` 由来のキャラパックを同梱してよい（個人利用・権利範囲内）
- 拡張 VSIX にはキャラクター素材を同梱しない（コードのみ）
- Marketplace公開しない
- 個人利用のため会話履歴は保存してよい

---

# 14. 開発時の最初のタスク一覧

## Task 1: リポジトリ作成

- monorepo構成を作る
- TypeScript設定
- package manager設定
- lint/format設定

## Task 2: Electron Companion App雛形

- Electron起動
- React renderer
- Kanagawa Dragonテーマ
- UIモック移植

## Task 3: Character Runtime雛形

- PixiJS導入
- Spine Runtime導入
- canvas表示
- ローカルアセット読み込み口を作る

## Task 4: アニメーション抽出dev tool

- `.skel` からアニメーション一覧を抽出
- JSON出力
- motion-map初期生成補助

## Task 5: 調月リオ表示

- `CH0158_home.skel` 読み込み
- atlas/texture解決
- idle再生
- 手動状態切替UI

## Task 6: Chat UI実装

- セッションタブ
- メッセージバブル
- Agentアイコン
- ユーザーアイコンなし
- 入力欄
- ストリーム待ち（Thinking インジケータ + コンポーザー cancel。**実行中バーは §7.3.2**）

## Task 7: セッション保存

- ChatSession型
- local storage/file storage
- セッション作成/切替/削除

## Task 8: Cursor拡張雛形

- Cursorコマンド登録
- Mimica起動
- workspace/current file/selection取得
- Electronとの通信

## Task 9: Cursor SDK連携

- Agent実行
- ストリーミング回答
- キャンセル
- エラー処理

## Task 10: Agent状態とキャラ状態の連動

- event mapper
- thinking/talking/success/error/waiting
- motion-map連携
- fallback制御

---

# 15. 次に私が作るべきもの

この要件定義をもとに、次に作るべきドキュメント/成果物は以下。

```txt
1. Cursor開発開始用 README
2. アーキテクチャ詳細設計
3. 初期ディレクトリ構成とpackage.json案
4. motion-map.json 初期版
5. persona pack 雛形
6. Cursor拡張とElectron通信プロトコル
7. 実装Issue一覧
```

---

# 16. 現時点の最終方針

```txt
Project:
  Mimica

Editor:
  Cursor専用

Initial Character:
  調月リオ

UI:
  Electron外部ウィンドウ
  左/中央にメモロビ大きめ
  右にLINE/Slack風チャット
  Kanagawa Dragon風外装

Agent:
  Cursor SDK

Initial MVP:
  Agentチャット + ストリーミング + キャンセル + 現在ファイル/選択範囲 + キャラ状態連動 + セッション保存

Next Phase:
  コード編集 + 差分確認 + Accept/Reject + ターミナル/テスト実行

Character Runtime:
  PixiJS + Spine Runtime

Character Control:
  Agent event → AvatarState → motion-map → Spine animation

Chat History:
  チャットセッション単位で保存

Persona:
  調月リオの口調・口癖を軽く反映
  技術回答は通常品質を維持

Distribution:
  Marketplace / 公開配布しない
  公開 mimica リポジトリ・公開 Release には Spine / キャラ素材を載せない
  プライベートタグ Release の Companion DMG のみ mimica-assets パック同梱可（個人利用・権利範囲内）
  VSIX はコードのみ（キャラ素材を同梱しない）
```
