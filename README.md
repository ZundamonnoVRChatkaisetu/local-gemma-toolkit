# Local Gemma Toolkit

プライバシーを重視した、ローカル環境で動作するGemma 27B（6B量子化）を活用したAIツールキット。オフライン環境で高機能なAI機能を提供します。

## 機能概要

### 1. ローカルLLMチャット
- Claudeのようなストリーミング応答
- コンテキスト対応の対話機能
- プライバシー保護（すべてのデータがローカルに保存）

### 2. DeepSearch
- ローカル文書のベクトル検索
- コンテキストを考慮した回答生成
- OpenManusに着想を得た検索拡張生成(RAG)

### 3. プライバシー保護型学習支援
- 学習履歴のローカル保存と分析
- パターン認識によるカスタム問題生成
- 進捗追跡とレコメンデーション

### 4. AI駆動型セキュリティ管理
- 行動パターン分析による異常検知
- コード・バイナリ解析
- リアルタイムアラート

## 技術スタック

- **フロントエンド**: Next.js, React, Tailwind CSS, shadcn/ui
- **バックエンド**: Node.js
- **データベース**: SQLite + Prisma
- **AI**: Gemma 27B (6B量子化)
- **ベクトルDB**: SQLite拡張またはベクトル検索対応ライブラリ

## インストール方法

```bash
# リポジトリのクローン
git clone https://github.com/ZundamonnoVRChatkaisetu/local-gemma-toolkit.git
cd local-gemma-toolkit

# 依存関係のインストール
npm install

# データベースのセットアップ
npm run db:setup

# 開発サーバーの起動
npm run dev
```

## セットアップ手順

### 1. llama.cppバイナリの設定

このプロジェクトではllama.cppのバイナリが必要です：

1. `bin`ディレクトリに`llama-server.exe`（Windows）または`llama-server`（Linux/Mac）を配置します
2. 詳細な入手方法は`bin/README.md`を参照してください

入手方法の選択肢：
- [llama.cpp公式リポジトリ](https://github.com/ggerganov/llama.cpp)からビルド
- [公式リリース](https://github.com/ggerganov/llama.cpp/releases)からダウンロード
- [LM Studio](https://lmstudio.ai/)や[KoboldCpp](https://github.com/LostRuins/koboldcpp)からバイナリを抽出

### 2. Gemma 27B (6B量子化)モデルの設定

1. **モデル入手**: LM StudioなどからGemma 27Bモデル（6B量子化版）のGGUFファイルをダウンロード
2. **モデル配置**: 
   - プロジェクトのルートディレクトリに`models`フォルダが存在しない場合は作成
   - ダウンロードしたGGUFファイルを`models`ディレクトリに配置
   - デフォルトのファイル名: `gemma-3-27b-it-Q6_K.gguf`（変更可能）
3. **自動検出**: アプリケーション起動時に`models`ディレクトリがスキャンされ、利用可能なモデルが自動的に検出されます
4. **デフォルト選択**: 複数のモデルがある場合、最大サイズのモデルが自動的にデフォルトとして選択されます

## 最新の更新（2025-03-17）

### サーバー初期化とヘルスチェックの改善
- サーバー初期化ロジックを強化し、503エラーを適切に処理
- サーバー起動中状態を検出し、正しくハンドリング
- ヘルスチェック機能の改善とエラー処理の強化
- 初期化完了の検出精度向上
- 通信エラー時の自動再試行機能の実装

### チャット機能の改善
- ストリーミングレスポンスの修正
- エラーハンドリングの強化
- 応答生成時のキャンセル機能の追加
- JSON応答の解析エラーを解決
- 終了トークン（`<end_of_turn>`）処理の修正

## トラブルシューティング

### ブラウザでのCORSエラー（チャット送信できない問題）

ブラウザのコンソールに以下のようなエラーが表示される場合：
```
Access to fetch at 'http://127.0.0.1:8080/completion' from origin 'http://localhost:3000' has been blocked by CORS policy
```

**解決方法**:
1. **CORSエラー対策**: 直接APIアクセスがブラウザにブロックされています。以下のいずれかの方法で解決できます：
   
   a) **推奨: llama-serverの起動オプション修正**:
   ```bash
   # bin/llama-server.exeの起動オプションに--cors '*'を追加
   bin/llama-server.exe --model models/gemma-3-27b-it-Q6_K.gguf --ctx-size 4096 --batch-size 512 --threads 21 --n-gpu-layers 32 --host 127.0.0.1 --port 8080 --cors '*' --mlock
   ```
   
   b) **代替: API経由での通信に切り替え**:
   - chat-interface.tsxファイル内の直接APIアクセス（`fetch('http://127.0.0.1:8080/completion'...`）部分をコメントアウトし、Next.js APIルート（`/api/chat`）経由の通信のみを使用

2. **サーバー再起動**: 上記の設定を適用後、アプリケーションを再起動してください。

### サーバー初期化エラー（503 Service Unavailable）

大規模モデル（例：27B）を使用する場合、初期ロード時に以下のようなエラーが表示されることがあります：

```
Error checking llama-server health: FetchError: request to http://127.0.0.1:8080/health failed, reason: connect ECONNREFUSED 127.0.0.1:8080
```

または：

```
srv log_server_r: request: GET /health 127.0.0.1 503
```

**解決方法**:
1. これはサーバーが起動中で、まだ完全に初期化されていないことを示します。通常は自動的に処理されます。
2. 大規模モデルでは、数分かかる場合があるのでしばらく待ちます。
3. コンソールに`main: server is listening on http://127.0.0.1:8080 - starting the main loop`というメッセージが表示されれば、サーバーは正常に起動しています。
4. このエラーが継続的に表示される場合は、アプリケーションを再起動してみてください。

### npm installでエラーが発生する場合

以下のようなエラーが発生した場合:
```
npm error code ETARGET
npm error notarget No matching version found for typescript-eslint@^5.59.0.
```

これは依存関係の指定に問題がある可能性があります。最新のリポジトリでは修正されていますが、問題が続く場合は以下の手順を試してください:

1. `package.json`ファイルを開く
2. `devDependencies`セクションの`typescript-eslint`を確認
3. 必要に応じて`@typescript-eslint/eslint-plugin`と`@typescript-eslint/parser`に変更
4. 再度`npm install`を実行

### llama-serverが見つからないエラー

```
llama.cpp binary not found or not executable at bin\\llama-server.exe
```

1. `bin`ディレクトリが存在することを確認
2. `bin`ディレクトリに`llama-server.exe`（Windows）または`llama-server`（Linux/Mac）が存在することを確認
3. ファイルに実行権限があることを確認（Linux/Mac）
4. ファイルの入手方法は`bin/README.md`を参照

### モデルファイルが見つからないエラー

```
Model file not found or not readable at /path/to/model.gguf
```

1. `models`ディレクトリが存在することを確認
2. `models`ディレクトリに`.gguf`または`.bin`拡張子のモデルファイルが存在することを確認
3. ファイルの読み取り権限があることを確認
4. モデル名の設定が正しいことを確認（デフォルトは`gemma-3-27b-it-Q6_K.gguf`）

### チャット機能でエラーが発生する場合

1. ブラウザの開発者コンソールでエラーを確認してください
2. APIレスポンスが異常な形式であるか、応答パーシングに問題がある可能性があります
3. ストリーミングモードの切り替えを試してみてください（現在はストリーミングが推奨されています）
4. サーバー初期化中の場合は、数分待ってから再試行してください

### 応答が遅い、または無応答の場合

1. モデルの初期化が完了しているか確認してください
2. 大きなモデル（27B）は応答生成に時間がかかることがあります（特に初回）
3. GPUのメモリ不足が発生している可能性があります（コンソールログを確認）
4. モデルパラメータ（コンテキストサイズやバッチサイズ）の調整を検討してください

### GPUメモリ問題

```
CUDA error: out of memory
```

1. `gpuLayers`の数を減らしてみてください（src/lib/gemma/llama-cpp.tsの`DEFAULT_LLAMA_CONFIG`）
2. より小さいモデルの使用を検討してください
3. コンテキストサイズ（contextSize）を小さくしてみてください
4. バッチサイズ（batchSize）を小さくしてみてください

### 言語設定

現在のバージョンではUIの日本語化が実装されています。さらなる言語設定やカスタマイズが必要な場合は、コードを参照してください。

### その他の問題

プロジェクトに関する問題やエラーは、GitHubのIssuesセクションで報告してください。

## 貢献について

プルリクエストやイシューの作成は大歓迎です。大きな変更を行う場合は、まずイシューを開いて議論してください。

## ライセンス

MIT