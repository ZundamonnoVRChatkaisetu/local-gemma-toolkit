# llama.cpp バイナリについて

このディレクトリには、llama.cppのサーバーバイナリを配置する必要があります。

## 必要なファイル

- Windows: `llama-server.exe`
- Linux/macOS: `llama-server`

## バイナリの入手方法

### オプション1: 公式リポジトリからビルド

1. [llama.cpp公式リポジトリ](https://github.com/ggerganov/llama.cpp)をクローン
2. リポジトリのREADMEに従ってビルド
3. 生成された`llama-server`または`llama-server.exe`をこのディレクトリにコピー

### オプション2: リリース済みバイナリをダウンロード

1. [llama.cpp公式リリースページ](https://github.com/ggerganov/llama.cpp/releases)にアクセス
2. お使いのプラットフォーム用のバイナリがあればダウンロード
3. 解凍して`llama-server`または`llama-server.exe`をこのディレクトリにコピー

### オプション3: サードパーティのビルド済みバイナリ

一部のサードパーティプロジェクトでは、llama.cppの事前ビルド済みバイナリを提供しています：

- [LM Studio](https://lmstudio.ai/)からバイナリを抽出
- [KoboldCpp](https://github.com/LostRuins/koboldcpp/releases)からバイナリを抽出

## 設定

バイナリを配置したら、再起動時に自動的に検出されます。
