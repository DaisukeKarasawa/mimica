# Mimica

Cursor 上の開発体験を、キャラクターエージェント（調月リオ）との会話体験として再構成する Companion アプリ。

## ドキュメント

- [要件定義](docs/requirements.md)
- [キックオフガイド](docs/project-kickoff.md)
- [UI モック](docs/ui-mock.html)

## 前提

- macOS
- Node.js 20+
- pnpm 9+
- Cursor（拡張開発用）

## セットアップ

```bash
corepack enable
pnpm install
pnpm build
```

## 開発

```bash
# Companion アプリ（Electron）
pnpm dev:companion

# Cursor 拡張（watch）
pnpm dev:extension
```

### Cursor 拡張の読み込み

1. Cursor で `apps/cursor-extension` を Extension Development Host として開く
2. または F5 でデバッグ起動
3. コマンドパレット → `Mimica: Open Companion`

## 環境変数・API キー

**リポジトリの設定ファイルには API キーを書きません。** 詳細は [docs/secrets-setup.md](docs/secrets-setup.md)。

```bash
# 推奨: 環境変数
export CURSOR_API_KEY="key_..."

# または .env（Git 管理外）
cp .env.example .env
```

## アセット

Spine 素材は Git 管理外。

- **BA-AD（ソースビルド・推奨）**: [docs/baad-build-from-source-macos.md](docs/baad-build-from-source-macos.md)
- **入手〜配置の全体**: [docs/spine-asset-guide.md](docs/spine-asset-guide.md)

```bash
mkdir -p ~/MimicaAssets/characters/rio/textures
cp templates/assets/*.json ~/MimicaAssets/characters/rio/
```

## Persona（wiki セリフ）

[templates/persona/README.md](templates/persona/README.md) — Git には雛形のみ。  
wiki セリフは `~/MimicaAssets/characters/rio/persona/lines.json` にローカル配置（Git 管理外）。

## セキュリティ

```bash
pnpm audit
pnpm security   # audit + typecheck
```

## 構成

```txt
apps/
  companion/          Electron + React UI
  cursor-extension/   Cursor 拡張
packages/
  shared/             型・プロトコル
  ui/                 テーマ
  character-runtime/  Spine / Avatar 制御
  agent-orchestrator/ Agent 連携
```
