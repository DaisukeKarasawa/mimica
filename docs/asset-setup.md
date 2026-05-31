# アセットセットアップ

> **詳細手順（入手〜配置まで）**: [spine-asset-guide.md](./spine-asset-guide.md) を参照。

調月リオの Spine 素材を Mimica で使うためのクイックリファレンス。

## クイック開始

```bash
mkdir -p ~/MimicaAssets/characters/rio/textures
cp templates/assets/*.json ~/MimicaAssets/characters/rio/
```

## 必要ファイル

| ファイル                            | 説明                          |
| ----------------------------------- | ----------------------------- |
| `CH0158_home.skel`                  | Spine スケルトン              |
| `CH0158_home.atlas`                 | アトラス定義                  |
| `textures/*.png`                    | テクスチャ                    |
| `metadata.json` / `motion-map.json` | Mimica テンプレートからコピー |

## 入手

[spine-asset-guide.md](./spine-asset-guide.md) — BA-AD ダウンロード → UnityPy 抽出 → 配置

## 注意

- 個人利用・非配布・Git 非管理
- メモロビ素材の色は UI テーマで上書きしない
