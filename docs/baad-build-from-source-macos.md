# BA-AD をソースからビルドして使う（macOS）

Releases の zip バイナリは使わず、**GitHub のソースをクローン → 自分の Mac でビルド** する手順。

- macOS の「マルウェア検証」ダイアログを避けやすい
- 中身は公開リポジトリのソースから追える
- 個人利用・非配布の前提は変わりません

---

## 全体の流れ

```txt
① ターミナルを開く
② Xcode コマンドラインツール（初回だけ）
③ Rust（rustup）を入れる
④ BA-AD を git clone
⑤ cargo build でビルド（初回は 5〜15 分）
⑥ baad --version で確認
⑦ 調月リオ（CH0158）をダウンロード
⑧ spine-asset-guide.md §4 以降（抽出・配置）
```

---

## ① ターミナルを開く

**⌘ + スペース** →「**terminal**」→ Enter

---

## ② Xcode コマンドラインツール（初回だけ）

Rust のビルドに必要です。

```bash
xcode-select --install
```

- ポップアップが出たら **「インストール」**
- すでに入っている場合は「インストール済み」と出る → そのまま次へ

---

## ③ Rust（rustup）を入れる

### 3-1. インストール

ターミナルに貼り付けて Enter:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

表示された質問:

| 質問                                     | 選び方                                        |
| ---------------------------------------- | --------------------------------------------- |
| `1) Proceed with installation (default)` | **1** を押して Enter（そのまま Enter でも可） |

### 3-2. パスを反映

```bash
source "$HOME/.cargo/env"
```

### 3-3. 確認

```bash
rustc --version
cargo --version
```

どちらも `1.xx.x` のようにバージョンが出れば OK。

> **毎回 `cargo: command not found` になる場合**  
> `~/.zshrc` に次が入っているか確認:
>
> ```bash
> echo 'source "$HOME/.cargo/env"' >> ~/.zshrc
> source ~/.zshrc
> ```

---

## ④ BA-AD をクローンする

作業用フォルダを作って clone します（Mimica とは別で OK）。

```bash
mkdir -p ~/dev
cd ~/dev
git clone https://github.com/Deathemonic/BA-AD.git
cd BA-AD
```

### 確認

```bash
pwd
# → /Users/あなたの名前/dev/BA-AD

ls
# Cargo.toml  README.md  src/  などが見える
```

---

## ⑤ ビルドする

### 方法 A: リポジトリ内に置く（おすすめ・シンプル）

```bash
cd ~/dev/BA-AD
cargo build --release --locked
```

- **初回は 5〜15 分** かかることがあります（依存 crate のダウンロード）
- 最後に `Finished release` と出れば成功

バイナリの場所:

```txt
~/dev/BA-AD/target/release/baad
```

### 方法 B: ~/.cargo/bin にインストール（どこからでも baad と打ちたい）

```bash
cd ~/dev/BA-AD
cargo install --path . --locked
```

`~/.cargo/bin/baad` ができます（`source ~/.cargo/env` 済みなら PATH に入っています）。

---

## ⑥ 動作確認

### 方法 A を選んだ場合

```bash
~/dev/BA-AD/target/release/baad --version
```

毎回打つのが面倒なら、エイリアスまたは symlink:

```bash
mkdir -p ~/bin
ln -sf ~/dev/BA-AD/target/release/baad ~/bin/baad
echo 'export PATH="$HOME/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
baad --version
```

### 方法 B を選んだ場合

```bash
baad --version
```

バージョン番号が出れば **ビルド成功** です。  
（Releases zip より **Gatekeeper の警告は出にくい** です）

---

## ⑦ 初回キャッシュ更新

```bash
baad --update
```

数分かかることがあります。完了まで待ちます。

---

## ⑧ 調月リオ（CH0158）をダウンロード

```bash
mkdir -p ~/Downloads/mimica-ba-rio/bundles
cd ~/Downloads/mimica-ba-rio

baad download japan \
  --assets \
  --filter "ch0158_home" \
  --filter-method contains-ignore-case \
  --output ./bundles
```

**0 件のとき**（フィルタを広げる）:

```bash
baad download japan \
  --assets \
  --filter "ch0158" \
  --filter-method contains-ignore-case \
  --output ./bundles
```

**取れたか確認:**

```bash
find ./bundles -type f | wc -l
find ./bundles -iname "*ch0158*" | head -10
```

0 以外なら OK。

---

## ⑨ このあと

AssetBundle の中身（`.skel` / `.atlas` / PNG）を取り出す:

→ **[spine-asset-guide.md](./spine-asset-guide.md) §4 以降**

---

## よくあるつまずき

| 症状                                | 対処                                               |
| ----------------------------------- | -------------------------------------------------- |
| `cargo: command not found`          | `source "$HOME/.cargo/env"`                        |
| `linker cc not found`               | `xcode-select --install`                           |
| ビルドが遅い                        | 初回のみ。2 回目以降は速い                         |
| `baad: command not found`（方法 A） | `~/dev/BA-AD/target/release/baad` をフルパスで実行 |
| ダウンロード 0 件                   | `baad --clean` → `baad --update` → §⑧ 再実行       |

---

## ソースを更新したいとき

```bash
cd ~/dev/BA-AD
git pull
cargo build --release --locked
# 方法 B の場合
cargo install --path . --locked
```

---

## もう使わないとき

```bash
rm -rf ~/dev/BA-AD
rm -rf ~/Downloads/mimica-ba-rio
# baad コマンドだけ消す（方法 B）
rm ~/.cargo/bin/baad
```

---

## 関連

- リポジトリ: https://github.com/Deathemonic/BA-AD
- Mimica 全体: [spine-asset-guide.md](./spine-asset-guide.md)
- zip 版（非推奨）: [baad-install-macos.md](./baad-install-macos.md)
