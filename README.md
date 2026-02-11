# TranslaChat

日本語ユーザーと韓国語ユーザーがリアルタイムでチャットできるCLIツール。
メッセージは相手の言語に自動翻訳され、LINE風のTUIで表示されます。

翻訳にはローカルの [TranslateGemma 12B](https://huggingface.co/google/translate-gemma-12b-it) (GGUF) を使用し、外部APIへの送信は一切ありません。

## アーキテクチャ

```
[Terminal 1: ja user]  <--WebSocket-->  [Terminal 2: ko user]
        |                                       |
        +--------->  Translation API  <---------+
                   (Python Flask:5050)
                   TranslateGemma GGUF
```

- **翻訳API** (Python Flask) — TranslateGemma GGUFモデルのRESTラッパー
- **CLIチャット** (Node.js) — blessed TUIでLINE風チャット + WebSocket通信

## 必要なもの

- Python 3.10+
- Node.js 18+
- NVIDIA GPU (VRAM 8GB以上推奨)
- Python パッケージ: `flask`, `llama-cpp-python`
- TranslateGemma 12B GGUF モデル

## セットアップ

### 1. モデルのダウンロード

```bash
# Hugging Faceからダウンロード (Q4_K_M, 6.8GB)
mkdir -p ~/models
# https://huggingface.co/google/translate-gemma-12b-it のGGUF版を配置
# デフォルトパス: ~/models/translategemma-12b-it-q4_k_m.gguf
```

### 2. Python依存パッケージ

```bash
pip install flask llama-cpp-python
```

### 3. Node.js依存パッケージ

```bash
cd cli-app
npm install
npm link  # translachatコマンドをグローバルに登録
```

## 使い方

### Step 1: 翻訳APIを起動

```bash
./translation-api/start.sh
```

または直接:

```bash
python translation-api/server.py
```

APIが `http://localhost:5050` で起動します。

### Step 2: ホストがチャットルームを作成

```bash
translachat host --lang ja --name Naoto
```

### Step 3: 別のターミナルからチャットに参加

```bash
translachat join --lang ko --host localhost:3000 --name MinJi
```

## メッセージ表示

**日本語ユーザーの画面:**
- 自分のメッセージ → 日本語そのまま (緑背景、右寄せ)
- 相手のメッセージ → 日本語翻訳 (白) + 原文韓国語 (グレー)

**韓国語ユーザーの画面:**
- 自分のメッセージ → 韓国語そのまま (緑背景、右寄せ)
- 相手のメッセージ → 韓国語翻訳 (白) + 原文日本語 (グレー)

## 翻訳API

単体でも使えます:

```bash
# ヘルスチェック
curl http://localhost:5050/health

# 日本語 → 韓国語
curl -X POST http://localhost:5050/translate \
  -H 'Content-Type: application/json' \
  -d '{"text":"こんにちは","source_lang":"ja","target_lang":"ko"}'

# 韓国語 → 日本語
curl -X POST http://localhost:5050/translate \
  -H 'Content-Type: application/json' \
  -d '{"text":"감사합니다","source_lang":"ko","target_lang":"ja"}'
```

## CLIオプション

```
translachat host [options]
  --lang <lang>   言語コード (ja/ko)
  --name <name>   表示名
  --port <port>   WebSocketポート (デフォルト: 3000)

translachat join [options]
  --lang <lang>   言語コード (ja/ko)
  --name <name>   表示名
  --host <host>   ホストアドレス (例: localhost:3000)
```

## ファイル構成

```
translachat/
├── translation-api/
│   ├── server.py          # Flask翻訳API (port 5050)
│   └── start.sh           # 起動スクリプト
├── cli-app/
│   ├── package.json
│   ├── bin/
│   │   └── translachat.js # CLIエントリポイント
│   ├── src/
│   │   ├── server.js      # WebSocketサーバー (host)
│   │   ├── client.js      # WebSocketクライアント (join)
│   │   ├── ui.js          # blessed TUI
│   │   ├── translator.js  # 翻訳APIクライアント
│   │   └── protocol.js    # メッセージ型定義
│   └── test-e2e.js        # E2Eテスト
└── README.md
```

## ライセンス

MIT
