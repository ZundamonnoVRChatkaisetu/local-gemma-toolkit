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

## Gemma 27B (6B量子化)モデルの設定

1. **モデル入手**: LM StudioなどからGemma 27Bモデル（6B量子化版）のGGUFファイルをダウンロード
2. **モデル配置**: 
   - プロジェクトのルートディレクトリに`models`フォルダが存在しない場合は作成
   - ダウンロードしたGGUFファイルを`models`ディレクトリに配置
   - 推奨ファイル命名形式: `[モデル名]-[パラメータ数]-[量子化].gguf`
   - 例: `gemma-27b-q4_0.gguf`、`gemma-6b-q5_k.gguf`など
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

### モデルが検出されない場合

1. モデルファイルが正しく`models`ディレクトリに配置されているか確認
2. ファイル形式が`.gguf`または`.bin`であることを確認
3. ファイルの読み取り権限が適切に設定されているか確認

### 言語設定

現在のバージョンではUIの日本語化が実装されています。さらなる言語設定やカスタマイズが必要な場合は、コードを参照してください。

### その他の問題

プロジェクトに関する問題やエラーは、GitHubのIssuesセクションで報告してください。

## 貢献について

プルリクエストやイシューの作成は大歓迎です。大きな変更を行う場合は、まずイシューを開いて議論してください。

## ライセンス

MIT
