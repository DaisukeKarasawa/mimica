# BA-AD インストール手順（macOS・超詳細版）

**BA-AD（バード）** とは、Blue Archive のゲームデータ（AssetBundle）をインターネットから取ってきて、自分の Mac に保存する**道具（プログラム）**です。

Mimica 用の調月リオ Spine 素材を取る**第 2 ステップ**で使います。

> 個人利用のみ。取ったデータを人に渡したり、ネット公開したりしないでください。

---

## このガイドでやること

1. 自分の Mac が **M1/M2/M3 系** か **Intel 系** か調べる  
2. **ターミナル** を開けるようにする  
3. GitHub から BA-AD を **ダウンロード** する  
4. ダウンロードした **zip を解凍** する  
5. Mac の **セキュリティ警告** を通す  
6. `baad` コマンドを **どこからでも使える** ように置く  
7. ちゃんと入ったか **テスト** する  
8. 調月リオ（CH0158）のデータを **ダウンロード開始** する  

---

## 0. 用語ミニ辞典

| 言葉 | 意味（ここでは） |
|------|------------------|
| ターミナル | 文字で Mac に命令を出す黒い（または白い）画面 |
| コマンド | ターミナルに打つ 1 行の命令 |
| zip | ファイルをまとめて圧縮した入れ物。ダブルクリックで中身が出る |
| パス | ファイルの場所（住所） |
| `~` | あなたのホームフォルダ（`/Users/あなたの名前`）の省略記号 |
| `baad` | BA-AD プログラムを起動するコマンド名 |

---

## 1. Mac の種類を調べる（どの zip を取るか決める）

### 方法 A: 画面から（おすすめ）

1. 画面左上の **リンゴマーク** をクリック  
2. **「この Macについて」** をクリック  
3. **「チップ」** または **「プロセッサ」** を見る  

| 表示 | 取る BA-AD |
|------|------------|
| Apple M1 / M2 / M3 / M4 など | **baad-macos-aarch64.zip** |
| Intel Core i5 / i7 など | **baad-macos-x86_64.zip**（Releases にある場合） |

### 方法 B: ターミナルから

```bash
uname -m
```

| 結果 | 意味 |
|------|------|
| `arm64` | Apple Silicon → **aarch64** 版 |
| `x86_64` | Intel → **x86_64** 版 |

---

## 2. ターミナルを開く

### 方法 A: Spotlight（いちばん簡単）

1. キーボードで **Command（⌘）+ スペース** を同時押し  
2. 「**terminal**」または「**ターミナル**」と入力  
3. **Enter**  

### 方法 B: Finder から

1. **Finder** を開く  
2. メニュー **移動** → **ユーティリティ**  
3. **ターミナル** をダブルクリック  

### 開けたか確認

白または黒のウィンドウに、だいたい次のような文字が出ていれば OK:

```txt
daisuke@MacBook ~ %
```

最後の `%` や `$` の右に、これからコマンドを打ちます。

---

## 3. GitHub から BA-AD をダウンロードする

### 3-1. ブラウザで Releases ページを開く

1. **Safari** または **Chrome** を開く  
2. 次のアドレスを **アドレスバーにコピペ** して Enter:

```txt
https://github.com/Deathemonic/BA-AD/releases/latest
```

3. ページが開いたら、下の方にある **Assets**（アセット）という折りたたみを **クリックして広げる**

### 3-2. 正しいファイルを選ぶ

一覧から **1 つだけ** 選んでクリックしてダウンロード:

| あなたの Mac | クリックするファイル名（例） |
|--------------|------------------------------|
| Apple Silicon (M1/M2/M3…) | `baad-macos-aarch64.zip` |
| Intel | `baad-macos-x86_64.zip` |

### 3-3. ダウンロード完了の確認

1. **Dock**（画面下）の **ダウンロード** フォルダアイコンをクリック  
   - または Finder → **ダウンロード**  
2. `baad-macos-aarch64.zip`（または x86_64）があること  

---

## 4. zip を解凍する

### 方法 A: Finder で（おすすめ）

1. **ダウンロード** フォルダを開く  
2. `baad-macos-aarch64.zip` を **ダブルクリック**  
3. 同じフォルダに **`baad`** というファイル（または `baad-macos-aarch64` フォルダ）が現れる  

### 方法 B: ターミナルで

```bash
cd ~/Downloads
unzip baad-macos-aarch64.zip
```

`x86_64` 版の場合はファイル名を読み替えてください。

### 解凍後の確認

Finder のダウンロードフォルダに **`baad`** というファイルがあること。  
（フォルダの中に `baad` がある場合は、その中の `baad` を使います）

---

## 5. Mac のセキュリティ警告を通す

初めて `baad` を動かすと、Mac が「開発元を確認できません」と止めることがあります。

### 5-1. まず一度、ターミナルから実行してみる

```bash
cd ~/Downloads
chmod +x baad
./baad --version
```

- **バージョン番号**（例: `baad 2.9.2`）が出れば **§6 へ**  
- **ブロックされた** 場合は 5-2 へ  

### 5-2. 「開けない」と言われたとき

#### パターン A: ダイアログに「キャンセル」「開く」

1. **システム設定**（またはシステム環境設定）を開く  
2. **プライバシーとセキュリティ**  
3. 下の方に **「"baad" はブロックされましたが、開くことができます」** のような表示 → **「このまま開く」**  

もう一度ターミナルで:

```bash
cd ~/Downloads
./baad --version
```

#### パターン B: ターミナルで quarantine を外す（上記でダメなとき）

```bash
cd ~/Downloads
xattr -cr baad
chmod +x baad
./baad --version
```

`xattr` は「Mac の『ネットから取ったファイル』マークを消す」コマンドです。

---

## 6. `baad` をどこからでも使える場所に置く

今は `~/Downloads/baad` にしかいないので、**どのフォルダからでも `baad` と打てる** ように移動します。

### 6-1. 自分専用フォルダを作る（おすすめ）

ターミナルに **1 行ずつ** コピペして Enter:

```bash
mkdir -p ~/bin
mv ~/Downloads/baad ~/bin/baad
chmod +x ~/bin/baad
```

### 6-2. PATH に ~/bin を追加（初回だけ）

**あなたの Mac が zsh（普通は zsh）の場合:**

```bash
echo 'export PATH="$HOME/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### 6-3. どこからでも動くか確認

**ターミナルを一度閉じて、もう一度開いてから:**

```bash
baad --version
```

バージョンが表示されれば **インストール成功** です。

### うまくいかないとき

毎回フルパスで呼べます:

```bash
~/bin/baad --version
```

---

## 7. BA-AD の動作テスト（本番の前に）

### 7-1. ヘルプが見れるか

```bash
baad --help
```

たくさん英語が出れば OK（全部読む必要はありません）。

### 7-2. キャッシュ更新（初回は時間がかかる）

```bash
baad --update
```

- 初回は **数分** かかることがあります  
- 途中で止めない  
- エラーが出たら **もう一度同じコマンド**  

---

## 8. 調月リオ（CH0158）のデータをダウンロードする

ここからが **BA-AD の本番** です。

### 8-1. 保存場所のフォルダを作る

```bash
mkdir -p ~/Downloads/mimica-ba-rio/bundles
cd ~/Downloads/mimica-ba-rio
```

### 8-2. ダウンロード実行（第 1 候補）

```bash
baad download japan \
  --assets \
  --filter "ch0158_home" \
  --filter-method contains-ignore-case \
  --output ./bundles
```

#### コマンドの意味（1 行ずつ）

| 部分 | 意味 |
|------|------|
| `baad` | BA-AD プログラムを起動 |
| `download japan` | 日本サーバー版のデータを取る |
| `--assets` | キャラ表示用の AssetBundle を取る |
| `--filter "ch0158_home"` | 調月リオの home（メモロビ）っぽい名前だけ |
| `--filter-method contains-ignore-case` | 大文字小文字を無視して部分一致 |
| `--output ./bundles` | 今いるフォルダの `bundles` に保存 |

### 8-3. 0 件だったとき（第 2 候補）

フィルタを広げます:

```bash
baad download japan \
  --assets \
  --filter "ch0158" \
  --filter-method contains-ignore-case \
  --output ./bundles
```

### 8-4. ダウンロードできたか確認

```bash
find ./bundles -type f | wc -l
```

- **0 以外** → 成功  
- **0** → `baad --clean` のあと 8-2 を再実行  

```bash
find ./bundles -iname "*ch0158*" | head -10
```

ファイルパスが表示されれば OK。

---

## 9. このあとやること（Spine 素材ガイドへ）

BA-AD は **「圧縮パックを取ってくる」** ところまで。  
中身の `.skel` / `.atlas` / 画像を取り出すのは **次のステップ** です。

→ **[spine-asset-guide.md](./spine-asset-guide.md) の「§4 以降」** に進んでください。

---

## よくあるつまずき

| 症状 | 対処 |
|------|------|
| `baad: command not found` | §6 をやり直す。または `~/bin/baad` とフルパスで実行 |
| 開けない / 壊れている | §5-2 の `xattr -cr` |
| ダウンロード 0 件 | §8-3 に広げる / `baad --update` / `baad --clean` |
| 非常に遅い | 回線・サーバー側。待つ |
| Intel Mac なのに aarch64 を取った | §1 で確認し直し、正しい zip を再 DL |

---

## 関連リンク

- BA-AD Releases: https://github.com/Deathemonic/BA-AD/releases/latest  
- Mimica 全体手順: [spine-asset-guide.md](./spine-asset-guide.md)
