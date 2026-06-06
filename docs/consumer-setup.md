# 別 PC セットアップ（Consumer）

**mimica リポジトリの clone / `pnpm build` は不要**です。プライベート GitHub Release から **VSIX + Companion（`.dmg`）** を取得してインストールします。

Companion には **`rio` キャラクターパック**（Spine + persona）が同梱されています。`~/MimicaAssets` の手動作成は不要です。

## 前提

- macOS
- [Cursor](https://cursor.com/) インストール済み
- プライベート GitHub Release へのアクセス（本人のみ）

## 1. Release から成果物を取得

1. GitHub の **Releases**（タグ `v*`）を開く
2. 次の 2 ファイルをダウンロード:
   - `mimica-cursor-extension-*.vsix`
   - `Mimica-*.dmg`（または同等の Companion DMG）

## 2. Companion（Mimica.app）をインストール

1. `.dmg` を開き **Mimica.app** を **Applications** にドラッグ
2. 未署名ビルドの場合、初回起動で Gatekeeper がブロックすることがあります  
   → Finder で Mimica.app を **右クリック → 開く**

インストール先のデフォルト: `/Applications/Mimica.app`  
別の場所に置いた場合は Cursor 設定 **`mimica.companionAppPath`** を変更してください。

## 3. Cursor 拡張（VSIX）をインストール

1. Cursor を開く
2. コマンドパレット → **`Extensions: Install from VSIX...`**
3. ダウンロードした `.vsix` を選択
4. 必要なら Cursor を再読み込み

## 4. 環境変数（Agent 利用時）

Agent 機能には **Cursor API キー** が必要です。詳細は [secrets-setup.md](./secrets-setup.md)。

```bash
# ~/.zshrc 等
export CURSOR_API_KEY="key_xxxxxxxx"
```

Cursor を **ターミナルから起動** した場合、上記が拡張・Companion に継承されます。Dock から起動する場合は `launchctl setenv` や Cursor 統合ターミナル経由でキーが見えるようにしてください。

### ブリッジ認証（拡張 ↔ Companion）

WebSocket 認証用トークンは次のいずれかで揃えます。

| 方法             | 説明                                                                                                                                                                   |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **自動（推奨）** | 一度 Companion を起動すると userData 内の `bridge-token`（macOS: `~/Library/Application Support/Mimica/bridge-token`）が作成されます。拡張はこのファイルを読み取ります |
| **明示指定**     | 開発機と同様、`MIMICA_BRIDGE_TOKEN` を環境変数で設定（Companion と拡張で同じ値）                                                                                       |

## 5. 使い方

1. Cursor で **任意のプロジェクト** を開く（mimica リポジトリである必要はありません）
2. コマンドパレット → **`Mimica: Open Companion`**
3. 外部ウィンドウに調月リオが表示され、現在の **workspace / ファイル / 選択範囲** が Companion に渡ります

キャラクターは **`activeCharacterId: "rio"`**（デフォルト）で、同梱パック `packs/rio/` から読み込まれます。

## トラブルシュート

| 症状                   | 確認                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------- |
| Companion が起動しない | `/Applications/Mimica.app` の有無、`mimica.companionAppPath`                                            |
| ブリッジ接続エラー     | Companion を一度起動して `bridge-token` ができているか、ポート `43721` が他プロセスに占有されていないか |
| キャラが表示されない   | Release 付属 DMG か（開発用ビルドは `~/MimicaAssets` フォールバックあり）                               |
| Agent が動かない       | `CURSOR_API_KEY` が Cursor プロセスから見えているか                                                     |

## 開発者向け（参考）

monorepo から拡張を動かす場合は、従来どおり **packaged より dev 起動**（`pnpm dev:companion`）が優先されます。手順は [README.md](../README.md) を参照。

## 関連

- [要件 §13.3 個人利用前提](./requirements.md) — 素材同梱ポリシー
- [mimica-assets セットアップ](./mimica-assets-setup.md) — Release ビルド側
- [Epic #11 Consumer release](https://github.com/DaisukeKarasawa/mimica/issues/11)
