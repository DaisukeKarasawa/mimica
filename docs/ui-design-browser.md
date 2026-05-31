# UI Lab（Cursor 内蔵ブラウザ + Design Mode）

Companion の React UI を **Electron なし**でブラウザ表示し、Cursor の **Design Mode** で見た目を調整するための環境です。

## 起動

```bash
pnpm dev:ui-lab
```

ターミナルに表示される URL（既定: **http://127.0.0.1:5180/**）を Cursor の内蔵ブラウザで開きます。

## Design Mode での調整

1. 内蔵ブラウザで UI Lab を開く
2. Design Mode を有効化（⌘⇧D など、Cursor のバージョンにより表記差あり）
3. 要素を選んでレイアウト・色・余白などを変更
4. **Apply** でリポジトリ内の CSS / React に反映
5. 保存後、Vite HMR でプレビューが更新される

主に触るファイル:

- `packages/ui/src/theme.css` — トークン（色・余白変数）
- `apps/companion/src/renderer/src/styles/*.css` — レイアウト・チャット・ステージ

## 本番確認

Design Mode はブラウザ上のプレビューです。Agent 連携や Spine 表示は Electron 側で確認してください。

```bash
pnpm dev:companion
```

## 制限（UI Lab）

| 項目 | UI Lab | Electron 本番 |
|------|--------|----------------|
| チャット見た目・タブ | ○ | ○ |
| `window.mimica` | メモリ内スタブ | IPC 本物 |
| Agent 送信 | 無視（ログのみ） | ○ |
| Spine キャラ | プレースホルダ | 素材配置後 ○ |
| セッション永続化 | なし（リロードでサンプル復元） | userData |

## Git

- UI Lab 用のスタブ・Vite 設定は **追跡してよい**（個人開発でも再現用）
- Design Mode の操作そのものは Git に残らない
- **Apply 後にコミットするのは CSS / React の差分のみ**
