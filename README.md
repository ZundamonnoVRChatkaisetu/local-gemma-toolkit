# Local Gemma Toolkit

ローカル環境でGemma LLMを実行するためのWebベースGUIツールキット

## 概要

Gemma 12Bモデルをローカルマシン上で簡単に実行し、チャット・検索・学習支援などの機能を提供するオールインワンパッケージです。

このツールキットは、llama.cpp/GGUFエコシステムを活用して、コンシューマーグレードのハードウェアでも高性能な推論を実現します。

## 主な機能

- **チャットインターフェース**: 自然な会話でGemmaモデルとやり取り
- **DeepSearch**: ローカルドキュメントやウェブコンテンツの検索機能
- **学習支援**: コンセプトの説明や課題の解決をサポート
- **パフォーマンス最適化**: GPU/CPUに対応した効率的な推論エンジン
- **セキュリティ**: すべてがローカルで実行され、データは外部に送信されません

## 必要システム要件

- **OS**: Windows 10/11, macOS, Linux
- **RAM**: 最低16GB (32GB推奨)
- **ストレージ**: 40GB以上の空き容量
- **GPU**: NVIDIA GPU 8GB VRAM以上 (オプション、ただし推奨)
- **CPU**: 6コア以上 (GPUがない場合は8コア以上推奨)

## セットアップ手順

### 1. 前提条件

- Node.js 20.x以上
- npm 10.x以上
- Git

### 2. リポジトリのクローン

```bash
git clone https://github.com/ZundamonnoVRChatkaisetu/local-gemma-toolkit.git
cd local-gemma-toolkit
```

### 3. 依存関係のインストール

```bash
npm install
```

### 4. モデルのダウンロード

Gemma 12Bモデルのquantized版（Q8_0.gguf）をダウンロードし、`models`ディレクトリに配置します。
モデルは「gemma-3-12b-it-Q8_0.gguf」を使用します。

### 5. llama-serverバイナリの取得

以下のいずれかの方法でllama-serverバイナリを取得し、`bin`ディレクトリに配置します。

**自動ダウンロード**:
```bash
node bin/download-llama-server.js
```

**または手動ダウンロード**:
1. [llama.cpp リリースページ](https://github.com/ggerganov/llama.cpp/releases) から最新のバイナリをダウンロード
2. `bin`ディレクトリに配置し、必要に応じて `llama-server` または `llama-server.exe` にリネーム

### 6. アプリケーションの起動

```bash
npm run dev
```

ブラウザで http://localhost:3000 にアクセスします。

## トラブルシューティング

### チャットが応答しない場合

通常、この問題は以下のいずれかが原因です：

1. **モデルの初期化中**: 大きなモデルはロードに時間がかかります。ページ上部の緑色のステータスインジケーターがサーバーの準備完了を示すまで待ってください。

2. **サーバー接続エラー**: サーバーへの接続に問題がある場合は、以下を試してください：
   - ページを再読み込み（F5キー）
   - 単純な質問をしてみる（例：「こんにちは」）
   - アプリケーションを再起動（ターミナルで`Ctrl+C`で終了後、再度`npm run dev`）

3. **エラーメッセージの確認**: エラーが表示された場合は、メッセージを確認して対応してください。「LLMサーバーが実行されていません」というメッセージが表示される場合は、アプリケーションの再起動が必要です。

### モデルの初期化に関する問題

初期起動時またはモデル変更後、以下の対応が有効です：

1. **十分な待機時間**: 初回起動時は大きなモデルのロードに数分かかることがあります。特に初回はNVRAMへの転送が発生するため時間がかかります。

2. **起動ログの確認**: ターミナルで起動ログを確認し、以下のようなメッセージが表示されるまで待ちます：
   ```
   llama_context: KV self size = 1536.00 MiB, K (f16): 768.00 MiB, V (f16): 768.00 MiB
   ...
   main: server is listening on http://127.0.0.1:8080 - starting the main loop
   ```

3. **再起動による解決**: 問題が継続する場合は、アプリケーションを再起動して再試行してください。

### CORS (Cross-Origin Resource Sharing) エラー

ブラウザからllama-serverに直接アクセスする際、CORSエラーが発生する場合があります。

1. **API経由でのアクセス**: デフォルトではブラウザはNext.jsのAPIルートを経由してllama-serverと通信します。この方法でCORS問題を回避できます。

2. **CORSサポートの確認**: 現在のバージョンでは、llama-serverの一部バージョンはCORSをサポートしていません。サーバーが起動する際に以下のメッセージが表示されるか確認してください：
   ```
   CORS is not supported by this llama-server version, disabling CORS option
   ```

## GPUサポート

GGUFモデルはGPUを使用して高速化できます。システムが自動的にGPUを検出し、適切な設定を行います。ログ出力で以下を確認してください：

```
Auto-detected GPU capabilities: XX layers
```

ここで「XX」は使用されるGPUレイヤー数で、GPUのVRAM容量に応じて変化します。

## 更新履歴

最新の進捗と変更点については [PROGRESS.md](PROGRESS.md) を参照してください。

## ライセンス

MITライセンス

## 注意事項

このツールキットはGemmaモデルを使用します。Gemmaは[Google](https://blog.google/technology/developers/gemma-open-models/)によってオープンソース化されたLLMです。モデルの使用に際しては、Gemmaモデルのライセンス条項に従ってください。

このツールキットは実験的プロジェクトです。本番環境での使用は自己責任でお願いします。