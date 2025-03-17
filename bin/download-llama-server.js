/**
 * llama-serverバイナリダウンロードスクリプト
 * 注意：GitHub APIトークンが必要な場合があります
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

// ダウンロード設定
const LLAMA_CPP_REPO = 'ggerganov/llama.cpp';
const LATEST_RELEASE_URL = `https://api.github.com/repos/${LLAMA_CPP_REPO}/releases/latest`;
const OUTPUT_DIR = path.join(__dirname);
const PLATFORM = process.platform;
const ARCH = process.arch;

// プラットフォームごとの設定
const platformConfig = {
  win32: {
    fileName: 'llama-server.exe',
    assetPattern: /windows/i
  },
  darwin: {
    fileName: 'llama-server',
    assetPattern: /macos|darwin/i
  },
  linux: {
    fileName: 'llama-server',
    assetPattern: /linux/i
  }
};

// 現在のプラットフォームの設定を取得
const currentPlatform = platformConfig[PLATFORM];
if (!currentPlatform) {
  console.error(`非対応プラットフォーム：${PLATFORM}`);
  process.exit(1);
}

// llama.cppの最新リリース情報を取得
function fetchLatestRelease() {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Local-Gemma-Toolkit-Downloader'
      }
    };

    // GitHubトークンがあれば使用
    if (process.env.GITHUB_TOKEN) {
      options.headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
    }

    https.get(LATEST_RELEASE_URL, options, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        // リダイレクトを処理
        https.get(res.headers.location, options, handleResponse).on('error', reject);
        return;
      }

      handleResponse(res);

      function handleResponse(response) {
        if (response.statusCode !== 200) {
          reject(new Error(`APIリクエストエラー: ${response.statusCode}`));
          return;
        }

        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => {
          try {
            const releaseInfo = JSON.parse(data);
            resolve(releaseInfo);
          } catch (err) {
            reject(new Error(`JSONパースエラー: ${err.message}`));
          }
        });
      }
    }).on('error', reject);
  });
}

// 適切なアセットを見つける
function findAssetForPlatform(assets) {
  // プラットフォームに合ったアセットを探す
  const platformAssets = assets.filter(asset => 
    currentPlatform.assetPattern.test(asset.name) && 
    asset.name.includes('server') &&
    asset.browser_download_url
  );

  if (platformAssets.length === 0) {
    return null;
  }

  // 複数マッチした場合は、アーキテクチャに合ったものを優先
  const archPattern = ARCH === 'x64' ? /64|x64|amd64/i : /arm|aarch/i;
  const archMatch = platformAssets.find(asset => archPattern.test(asset.name));
  
  return archMatch || platformAssets[0];
}

// ファイルをダウンロード
function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    console.log(`ダウンロード中: ${url}`);
    console.log(`保存先: ${outputPath}`);

    const options = {
      headers: {
        'User-Agent': 'Local-Gemma-Toolkit-Downloader'
      }
    };

    if (process.env.GITHUB_TOKEN) {
      options.headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
    }

    https.get(url, options, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        // リダイレクトを処理
        downloadFile(res.headers.location, outputPath)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`ダウンロードエラー: ${res.statusCode}`));
        return;
      }

      const file = fs.createWriteStream(outputPath);
      res.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve(outputPath);
      });

      file.on('error', (err) => {
        fs.unlink(outputPath, () => {}); // エラー時はファイルを削除
        reject(err);
      });
    }).on('error', reject);
  });
}

// ZIPファイルを解凍
async function extractZipFile(zipPath, outputDir) {
  try {
    // Windowsの場合はPowerShellを使用
    if (PLATFORM === 'win32') {
      execSync(`powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${outputDir}' -Force"`, { stdio: 'inherit' });
    } else {
      // macOSやLinuxの場合はunzipを使用
      execSync(`unzip -o "${zipPath}" -d "${outputDir}"`, { stdio: 'inherit' });
    }
    console.log(`解凍完了: ${zipPath} → ${outputDir}`);
    return true;
  } catch (err) {
    console.error(`解凍エラー: ${err.message}`);
    return false;
  }
}

// メイン処理
async function main() {
  try {
    console.log('▶️ llama-serverバイナリダウンロードスクリプト');
    console.log(`プラットフォーム: ${PLATFORM} (${ARCH})`);
    console.log(`出力ディレクトリ: ${OUTPUT_DIR}`);

    // 出力ディレクトリがない場合は作成
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
      console.log(`ディレクトリを作成しました: ${OUTPUT_DIR}`);
    }

    // 既存のバイナリがあれば確認
    const binaryPath = path.join(OUTPUT_DIR, currentPlatform.fileName);
    if (fs.existsSync(binaryPath)) {
      const answer = await promptUser(`既存のバイナリが見つかりました: ${binaryPath}\n上書きしますか？ (y/n): `);
      if (answer.toLowerCase() !== 'y') {
        console.log('ダウンロードをキャンセルしました');
        return;
      }
    }

    console.log('最新リリースを取得中...');
    const releaseInfo = await fetchLatestRelease();
    console.log(`最新リリース: ${releaseInfo.name || releaseInfo.tag_name}`);

    const assetToDownload = findAssetForPlatform(releaseInfo.assets);
    if (!assetToDownload) {
      console.error(`対応するアセットが見つかりませんでした`);
      const manualOptionMessage = 'マニュアルダウンロード手順:
' +
        '1. https://github.com/ggerganov/llama.cpp/releases にアクセス
' +
        '2. お使いのプラットフォームに適したバイナリをダウンロード
' +
        '3. 解凍して llama-server(またはllama-server.exe)をこのディレクトリに配置';
      console.log(manualOptionMessage);
      return;
    }

    console.log(`ダウンロードするファイル: ${assetToDownload.name}`);
    
    // テンポラリディレクトリを作成
    const tempDir = path.join(os.tmpdir(), 'llama-cpp-download-' + Date.now());
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // ファイルをダウンロード
    const downloadPath = path.join(tempDir, assetToDownload.name);
    await downloadFile(assetToDownload.browser_download_url, downloadPath);

    // ZIPの場合は解凍
    if (downloadPath.endsWith('.zip')) {
      await extractZipFile(downloadPath, tempDir);
      
      // 解凍後、必要なファイルを探す
      let serverBinary = null;
      function findServerBinary(dir) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          if (stat.isDirectory()) {
            const found = findServerBinary(filePath);
            if (found) return found;
          } else if (file === currentPlatform.fileName ||
                    (PLATFORM !== 'win32' && file.includes('server') && !file.endsWith('.h') && !file.endsWith('.c') && !file.endsWith('.txt'))) {
            return filePath;
          }
        }
        return null;
      }

      serverBinary = findServerBinary(tempDir);
      if (serverBinary) {
        fs.copyFileSync(serverBinary, binaryPath);
        console.log(`バイナリをコピーしました: ${serverBinary} → ${binaryPath}`);
      } else {
        console.error(`対象バイナリ ${currentPlatform.fileName} が解凍フォルダ内に見つかりませんでした`);
        return;
      }
    } else {
      // 直接バイナリの場合はコピー
      fs.copyFileSync(downloadPath, binaryPath);
      console.log(`バイナリをコピーしました: ${downloadPath} → ${binaryPath}`);
    }

    // Linux/macOSの場合は実行権限を付与
    if (PLATFORM !== 'win32') {
      fs.chmodSync(binaryPath, 0o755);
      console.log(`実行権限を付与しました: ${binaryPath}`);
    }

    // 一時ファイルを削除
    try {
      fs.rmdirSync(tempDir, { recursive: true });
      console.log(`一時ファイルを削除しました: ${tempDir}`);
    } catch (err) {
      console.warn(`一時ファイルの削除に失敗しました: ${err.message}`);
    }

    console.log('✅ ダウンロード完了！');
    console.log(`llama-serverバイナリが次の場所に配置されました: ${binaryPath}`);
  } catch (err) {
    console.error(`エラー: ${err.message}`);
    process.exit(1);
  }
}

// ユーザー入力を受け付けるヘルパー関数
function promptUser(question) {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    readline.question(question, answer => {
      readline.close();
      resolve(answer);
    });
  });
}

// スクリプトを実行
main().catch(err => {
  console.error(`予期せぬエラー: ${err.message}`);
  process.exit(1);
});
