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

## トラブルシューティング

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
llama.cpp binary not found or not executable at bin\llama-server.exe
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

### 言語設定

現在のバージョンではUIの日本語化が実装されています。さらなる言語設定やカスタマイズが必要な場合は、コードを参照してください。

### その他の問題

プロジェクトに関する問題やエラーは、GitHubのIssuesセクションで報告してください。

## 貢献について

プルリクエストやイシューの作成は大歓迎です。大きな変更を行う場合は、まずイシューを開いて議論してください。

## ライセンス

MIT
