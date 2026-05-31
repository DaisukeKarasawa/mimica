# Persona Pack 入力ガイド

調月リオの persona pack。**ゲーム原作セリフは Git 管理外**（`~/MimicaAssets/characters/rio/persona/` にローカル配置）。

## ファイル

| ファイル                   | Git      | 内容                                            |
| -------------------------- | -------- | ----------------------------------------------- |
| `SKILL.md`                 | あり     | Agent 向け persona 指示                         |
| `style.md`                 | あり     | 口調・性格・反映方針                            |
| `examples.md`              | あり     | 良い/悪い回答例                                 |
| `lines.json.example`       | あり     | セリフ JSON の雛形（プレースホルダのみ）        |
| `lines.source.txt.example` | あり     | 生セリフ入力の形式例                            |
| `lines.json`               | **なし** | カテゴリ別セリフ + リアクション（ローカルのみ） |
| `lines.source.txt`         | **なし** | wiki からの生セリフ（ローカルのみ）             |

## 初回セットアップ

```bash
mkdir -p ~/MimicaAssets/characters/rio/persona
cp templates/persona/{SKILL.md,style.md,examples.md} ~/MimicaAssets/characters/rio/persona/
cp templates/persona/lines.json.example ~/MimicaAssets/characters/rio/persona/lines.json
# wiki セリフを lines.source.txt に貼り付け → lines.json を整理
```

Companion 起動時も、上記ファイルが無ければ `templates/persona/` から自動コピーします（`lines.json` は `.example` から生成）。

## 人物像（整理の根拠）

- 合理主義・セミナー会長・「最も合理的な答えを提示」
- 先生（ユーザー）= 人生の唯一の変数。動揺・照れあり
- 「未来」は不確定で言語化しにくいが、先生がいると可能性を考えてしまう
- 技術回答本文は通常品質、口調は短い導入・締めのみ（Mimica 要件）
