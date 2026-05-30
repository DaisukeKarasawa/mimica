# シークレット / API キー設定

Mimica が Cursor SDK を使う際の `CURSOR_API_KEY` の扱い。

## 結論

| 保存場所                                            | 推奨           | Git 管理 |
| --------------------------------------------------- | -------------- | -------- |
| 環境変数 `CURSOR_API_KEY`                           | **最優先**     | しない   |
| `~/Library/Application Support/Mimica/secrets.json` | 環境変数の代替 | しない   |
| リポジトリ内の設定ファイル                          | **入れない**   | —        |

**Mimica の `settings.json` には API キーを書かない**設計にします。  
理由: 設定ファイルは将来 UI から編集・ログ出力・共有されやすく、漏洩リスクが高いため。

---

## 方法 1: 環境変数（推奨）

### 取得

1. [cursor.com/settings](https://cursor.com/settings) にログイン
2. **API Keys** で新規キーを作成
3. キーをコピー（再表示できない場合あり）

### 設定

`~/.zshrc` 等に追加:

```bash
export CURSOR_API_KEY="key_xxxxxxxx"
```

反映:

```bash
source ~/.zshrc
echo $CURSOR_API_KEY   # 空でなければ OK
```

Companion / Cursor 拡張は **親プロセスの環境変数** を継承します。  
ターミナルから `pnpm dev:companion` する場合は、そのシェルに設定が必要です。

Cursor 統合ターミナルでは `ELECTRON_RUN_AS_NODE=1` が付くことがあり、そのまま Electron を起動すると API 取得に失敗します。`pnpm dev:companion` は `apps/companion/scripts/run-electron-vite.mjs` でこの変数を外してから起動します。

---

## 方法 2: ローカル secrets ファイル（任意）

環境変数が使いにくい場合のみ。

```bash
mkdir -p ~/Library/Application\ Support/Mimica
cp templates/secrets.example.json ~/Library/Application\ Support/Mimica/secrets.json
```

`secrets.json` を編集:

```json
{
  "cursorApiKey": "key_xxxxxxxx"
}
```

- このファイルは **Git 管理外**
- パーミッション: `chmod 600 ~/Library/Application\ Support/Mimica/secrets.json`

**読み取り優先順位（Task 9 実装予定）**:

1. 環境変数 `CURSOR_API_KEY`
2. `secrets.json` の `cursorApiKey`
3. 未設定 → Agent 機能は無効、UI はモック応答のまま

---

## 方法 3: リポジトリ内 `.env`（開発時のみ）

```bash
cp .env.example .env
# .env を編集（Git には含めない）
```

`.env` は `.gitignore` 済み。ローカル開発用。

---

## やってはいけないこと

- `settings.json` / `package.json` / ソースコードに API キーを直書き
- Git に commit / push
- スクリーンショットやチャットへのキー貼り付け

---

## 関連

- [project-kickoff.md](./project-kickoff.md) §3.2
- テンプレート: `templates/secrets.example.json`, `.env.example`
