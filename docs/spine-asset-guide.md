# Spine 素材セットアップ — 最初から最後まで

調月リオ（**CH0158**）のメモロビ Spine 素材を入手し、Mimica が読める状態にする**全手順**。

> **利用条件**: 個人利用・自分の Mac の Mimica 用のみ。**再配布・Git 管理・公開禁止。**  
> Blue Archive の著作権は Yostar / NAT GAMES 等に帰属します。

---

## 全体フロー

```txt
[0] 前提確認
 ↓
[1] MimicaAssets ディレクトリ作成
 ↓
[2] BA-AD で CH0158 関連 AssetBundle をダウンロード
 ↓
[3] UnityPy で Bundle から .skel / .atlas / PNG を抽出
 ↓
[4] CH0158_home.* を特定
 ↓
[5] ~/MimicaAssets/characters/rio/ に配置
 ↓
[6] metadata.json / motion-map.json をコピー
 ↓
[7] 配置検証 → 開発側に連絡（Phase 1 着手）
```

所要時間の目安: **初回 30〜60 分**（回線・ディスク容量による）

---

## 0. 前提

| 項目         | 内容                                                        |
| ------------ | ----------------------------------------------------------- |
| OS           | macOS（Apple Silicon 想定。Intel の場合は x86_64 版 BA-AD） |
| ディスク     | 空き **5 GB 以上**（Bundle 一時保存用）                     |
| ネットワーク | 初回ダウンロードに必要                                      |
| Python       | 3.10+（抽出スクリプト用）                                   |

### 入手するファイル（最終形）

```txt
~/MimicaAssets/characters/rio/
├─ CH0158_home.skel
├─ CH0158_home.atlas
├─ textures/
│  └─ （.atlas が参照する PNG 群）
├─ metadata.json
├─ motion-map.json
└─ icon.png          ← 任意
```

---

## 1. MimicaAssets ディレクトリを作る

```bash
mkdir -p ~/MimicaAssets/characters/rio/textures
mkdir -p ~/MimicaAssets/characters/rio/persona

# Mimica リポジトリのテンプレートをコピー
cd /path/to/mimica   # リポジトリパス（clone 先に合わせて変更）
cp templates/assets/metadata.json ~/MimicaAssets/characters/rio/
cp templates/assets/motion-map.json ~/MimicaAssets/characters/rio/
```

---

## 2. BA-AD を用意する（AssetBundle ダウンローダ）

**推奨: ソースからビルド** → **[baad-build-from-source-macos.md](./baad-build-from-source-macos.md)**  
（git clone → cargo build。Gatekeeper 警告を避けやすい）

<details>
<summary>旧: zip バイナリ版（非推奨）</summary>

[baad-install-macos.md](./baad-install-macos.md)

</details>

> **Cargo 派**: `cargo install --git "https://github.com/Deathemonic/BA-AD" --locked --release` でも可。

---

## 3. CH0158（調月リオ）関連 AssetBundle をダウンロード

作業用ディレクトリを作成:

```bash
mkdir -p ~/Downloads/mimica-ba-rio
cd ~/Downloads/mimica-ba-rio
```

### 3-1. メモロビ home を狙ったフィルタ（推奨）

```bash
baad download japan \
  --assets \
  --filter "ch0158_home" \
  --filter-method contains-ignore-case \
  --output ./bundles
```

### 3-2. 見つからない場合は範囲を広げる

```bash
baad download japan \
  --assets \
  --filter "ch0158" \
  --filter-method contains-ignore-case \
  --output ./bundles
```

### 3-3. キャッシュ問題時

```bash
baad --clean
baad --update
# 再度 3-1 を実行
```

ダウンロード完了後:

```bash
find ./bundles -type f | wc -l    # 0 でなければ OK
find ./bundles -iname "*ch0158*" | head -20
```

---

## 4. AssetBundle から Spine 関連ファイルを抽出

### 4-1. Python 環境

```bash
python3 -m venv ~/.venvs/mimica-extract
source ~/.venvs/mimica-extract/bin/activate
pip install UnityPy Pillow
```

### 4-2. Mimica 付属スクリプトで一括抽出

```bash
cd /path/to/mimica
python scripts/extract-spine-bundles.py \
  ~/Downloads/mimica-ba-rio/bundles \
  ~/Downloads/mimica-ba-extracted
```

`TextAsset/` と `Texture2D/` 以下にファイルが出力されます。

### 4-3. CH0158_home 関連を検索

```bash
find ~/Downloads/mimica-ba-extracted -iname "*ch0158*" | sort
find ~/Downloads/mimica-ba-extracted -iname "*home*" | sort
find ~/Downloads/mimica-ba-extracted -iname "*.atlas" | sort
find ~/Downloads/mimica-ba-extracted -iname "*.skel*" | sort
```

探すキーワード:

- `CH0158`
- `home`（メモロビ用）
- `.skel` / `.skel.bytes` / `.atlas`

---

## 5. MimicaAssets へ配置

### 5-1. ファイル名の整理

Mimica はデフォルトで以下を想定:

- `CH0158_home.skel`
- `CH0158_home.atlas`

抽出結果が `CH0158_home.skel.bytes` 等の場合:

```bash
# 例（実際のパスは find 結果に合わせる）
SKEL_SRC=~/Downloads/mimica-ba-extracted/TextAsset/CH0158_home.skel.bytes
ATLAS_SRC=~/Downloads/mimica-ba-extracted/TextAsset/CH0158_home.atlas

cp "$SKEL_SRC" ~/MimicaAssets/characters/rio/CH0158_home.skel
cp "$ATLAS_SRC" ~/MimicaAssets/characters/rio/CH0158_home.atlas
```

名前が異なる場合は **中身が CH0158 home メモロビであることを確認**したうえで:

- **方法 A**: 上記想定名にリネーム
- **方法 B**: `metadata.json` の `skelFile` / `atlasFile` を実名に変更

### 5-2. テクスチャ（PNG）を textures/ へ

`.atlas` を開き、先頭付近の PNG ファイル名を確認:

```bash
head -20 ~/MimicaAssets/characters/rio/CH0158_home.atlas
```

列挙された PNG を **すべて** `textures/` にコピー:

```bash
# 例: 抽出結果から該当 PNG をコピー
cp ~/Downloads/mimica-ba-extracted/Texture2D/CH0158_home*.png \
   ~/MimicaAssets/characters/rio/textures/
```

`.atlas` 内のパスが `textures/xxx.png` 形式の場合、PNG は `rio/textures/` に置けば Mimica 側で解決します（Phase 1 実装で `--resolve` 確認）。

### 5-3. チャットアイコン（任意）

`icon.png` または `icon.jpg`（`icon.jpeg` / `icon.webp` も可）を配置すると Agent 吹き出し横に表示されます。既定は `icon.png` を参照しますが、**拡張子が違うだけの `icon.jpg` なども自動検出**します。

#### icon.png の例（旧見出し互換）

Agent 吹き出し横のアイコン。**正方形 PNG** 推奨（例: 128×128 以上）。

```bash
cp /path/to/your-icon.png ~/MimicaAssets/characters/rio/icon.png
```

| 項目     | 内容                                     |
| -------- | ---------------------------------------- |
| 配置先   | `~/MimicaAssets/characters/rio/icon.png` |
| Git      | コミットしない（ローカル素材）           |
| 未配置時 | グラデーションのプレースホルダー         |
| 反映     | `pnpm dev:companion` を再起動            |

別ファイル名にしたい場合は、当面 **`icon.*`（png/jpg/jpeg/webp）** のいずれかを `rio/` 直下に置く（`DEFAULT_SETTINGS.chatIconPath` は既定で `icon.png` を指すが、無いときは同ベース名・上記候補を順に探す）。

---

## 6. 配置検証

```bash
# 必須 3 点
test -f ~/MimicaAssets/characters/rio/CH0158_home.skel && echo "skel OK"
test -f ~/MimicaAssets/characters/rio/CH0158_home.atlas && echo "atlas OK"
ls ~/MimicaAssets/characters/rio/textures/*.png | head

# .atlas 参照と PNG の突合（手動）
grep -E '\.png$' ~/MimicaAssets/characters/rio/CH0158_home.atlas
ls ~/MimicaAssets/characters/rio/textures/
```

### チェックリスト

- [ ] `CH0158_home.skel` がある
- [ ] `CH0158_home.atlas` がある
- [ ] `.atlas` が参照する PNG が `textures/` に**すべて**ある
- [ ] `metadata.json` / `motion-map.json` がある
- [ ] ファイルを Git に add していない

### interaction.pet（idle 撫で＋首追従）

`metadata.json` に optional な `interaction.pet` を書くと、Companion の **idle 中**にステージ上の頭を撫でたとき、首がカーソル左右に追従し、表情（Blush / 目閉じ等）が変わります。離すと正面へ戻ります。

- 骨名・slot 名は **キャラごと**に `.skel` 内の実名へ合わせる（CH0158 向けの例は `templates/assets/metadata.json`）
- ヒット判定は **crop（実際に描画される矩形）基準**。canvas 全体ではない点に注意（crop は cover フィットで中央寄せ＋はみ出しのため、canvas 0–1 とはずれる）
- `hitSlots`（推奨）— 頭まわり slot 名の配列（例: `["Head"]`）。idle の生スケルトンから AABB を計算 → 画面座標へ変換してヒット判定。リサイズ・cover フィットに自動追従
- `hitPaddingPx` — 解決したヒット矩形の周囲に足す余白（px）。撫でやすさ調整用
- `hitRegionCropNormalized` — 手動の矩形（crop 0–1）。`hitSlots` 未設定/解決不可のときの fallback
- `hitBone` / `hitRadiusPx` — 上記いずれも解決できないときの最終 fallback（例: `Touch_Point`）
- `lookBone` — 首追従の基準 X（例: `Face_rot`）。未設定時はヒット矩形中心、なければ `hitBone`。首振りの可動幅は crop 幅基準
- `headRotationBones`（例: `Head_Rot` 系）は素材依存
- `maxRotationDeg` — 首追従の最大回転角（度）。カーソル追従の可動範囲を制限（例: `22`）
- `returnDurationMs` — 離脱後、正面へ戻るアニメの時間（ミリ秒）（例: `320`）
- `petAnimation`（推奨）— 撫で中に release track でループ再生する「撫でられ」アニメ（例: `Pat_01_A`）。頬染め・目閉じ・反応動作を作者データで駆動する。`Head_Rot` 系は毎フレーム上書きされるためカーソル追従が優先される
- `releaseAnimation` — 離したときの one-shot（例: `PatEnd_01_A`）
- 未設定のキャラは従来どおり idle ループのみ（後方互換）
- デバッグ: DevTools で `localStorage.setItem('mimica:petDebug','1')` → リロードでヒット矩形を緑枠で可視化（`window.__MIMICA_PET_DEBUG__ = true` や URL `?petDebug` でも可）
- 反映: `metadata.json` 保存後、`pnpm dev:companion` を再起動

---

## 6.1 Spine ランタイムのバージョン（重要）

抽出した `.skel` の先頭付近に **Spine バージョン文字列**（例: `4.2.33`）が入っています。  
Mimica の `@mimica/character-runtime` は **同じ 4.2 系**（`@esotericsoftware/spine-pixi-v8@4.2.x`）に揃えてください。

| 症状                         | 原因の例                                     |
| ---------------------------- | -------------------------------------------- |
| `Bone name must not be null` | `.skel` が 4.2 系なのにランタイムが 4.3 系   |
| アニメが再生されない         | `motion-map.json` の名前が実ファイルと不一致 |

アニメ名一覧:

```bash
pnpm --filter @mimica/character-runtime extract-animations ~/MimicaAssets/characters/rio/CH0158_home.skel
```

---

## 7. Mimica 側での最終確認（Phase 1 後）

素材配置完了を開発側に共有後:

`/path/to/mimica` はローカルの Mimica リポジトリ clone 先に読み替えてください。

```bash
cd /path/to/mimica   # リポジトリパス（clone 先に合わせて変更）
pnpm dev:companion
```

Phase 1 実装後:

```bash
pnpm --filter @mimica/character-runtime extract-animations -- \
  ~/MimicaAssets/characters/rio/CH0158_home.skel
```

アニメ名一覧と `motion-map.json` を照合します。

---

## トラブルシューティング

| 症状                   | 対処                                                |
| ---------------------- | --------------------------------------------------- |
| `baad` で 0 件         | `--filter "ch0158"` に広げる / `baad --update`      |
| `.skel` が見つからない | `find ... -iname "*0158*"` で再検索。Bundle 追加 DL |
| 画面が真っ白           | `textures/` に PNG 不足。`.atlas` と突合            |
| ファイル名が違う       | `metadata.json` を編集                              |
| UnityPy エラー         | `pip install -U UnityPy Pillow`                     |

### 代替: GUI ツール

コマンドが難しい場合:

1. [AssetStudio](https://github.com/aelurum/AssetStudio) 等で Bundle を開く
2. `CH0158` / `home` でフィルタ
3. TextAsset（.skel / .atlas）と Texture2D をエクスポート
4. §5 と同様に配置

---

## 8. 作業後の片付け（任意）

Bundle は容量が大きいため、配置確認後に削除可:

```bash
rm -rf ~/Downloads/mimica-ba-rio ~/Downloads/mimica-ba-extracted
deactivate  # venv
```

**`~/MimicaAssets/` だけ残す。**

---

## 関連

- [project-kickoff.md](./project-kickoff.md)
- [asset-setup.md](./asset-setup.md)（旧・短縮版へのリンク用）
- 抽出スクリプト: `scripts/extract-spine-bundles.py`
- テンプレート: `templates/assets/`
