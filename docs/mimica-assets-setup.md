# mimica-assets セットアップ

調月リオ（`rio`）の Spine / persona は **`mimica-assets`** プライベート repo が正本です。  
`mimica` リポジトリの `packs/rio/` はローカル用（symlink、Git 非追跡）。

## 1. Clone

```bash
git clone git@github.com:DaisukeKarasawa/mimica-assets.git ~/dev/mimica-assets
```

## 2. Link into mimica

```bash
cd ~/dev/mimica
./scripts/link-character-pack.sh
```

Companion dev は `packs/rio`（symlink）を優先し、無い場合は `~/MimicaAssets/characters/rio` にフォールバックします。  
上書き: `MIMICA_ASSETS_ROOT`（repo ルートまたは `~/MimicaAssets`）、`MIMICA_CHARACTER_PACK_ROOT`（パック直指定）。

## 3. GitHub Actions（Release 用）

`mimica` repo → **Settings → Secrets → Actions**:

| Secret                | 値                                          |
| --------------------- | ------------------------------------------- |
| `MIMICA_ASSETS_TOKEN` | `mimica-assets` 読み取り用 fine-grained PAT |

Release workflow（#8 実装後）がこの repo を checkout し `packs/` を Companion に同梱します。

## 初回のみ：手元からコピー

`mimica-assets` が空のとき、既存の `~/MimicaAssets/characters/rio/` から:

```bash
mkdir -p ~/dev/mimica-assets/packs/rio
rsync -a --exclude='*.bak' ~/MimicaAssets/characters/rio/ ~/dev/mimica-assets/packs/rio/
cd ~/dev/mimica-assets && git add packs && git commit -m "chore: add rio character pack"
```

## ローカル DMG（Companion + rio 同梱）

```bash
# mimica-assets が ../mimica-assets にある前提
pnpm package:companion:mac
# 成果物: apps/companion/release/*.dmg
```

未署名（ad-hoc）ビルドのため、初回起動時に macOS Gatekeeper でブロックされることがあります。システム設定の「このまま開く」や、Finder で右クリック →「開く」で回避してください。

## 関連 Issue

- [#5 bootstrap: mimica-assets](https://github.com/DaisukeKarasawa/mimica/issues/5)
- Epic [#11 Consumer release](https://github.com/DaisukeKarasawa/mimica/issues/11)
