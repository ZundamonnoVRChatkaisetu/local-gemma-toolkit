/**
 * llama.cpp統合モジュール
 * このモジュールはllama.cppの実行可能ファイルとの通信を管理します
 */

import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { once } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

// llama.cpp関連の設定
export interface LlamaCppConfig {
  // llama.cpp実行可能ファイルのパス
  binaryPath: string;
  // モデルパス
  modelPath: string;
  // コンテキストサイズ
  contextSize: number;
  // バッチサイズ
  batchSize: number;
  // スレッド数
  threads: number;
  // GPUに割り当てるレイヤー数（0=GPU無効）
  gpuLayers: number;
  // サーバーアドレス
  serverAddress: string;
  // サーバーポート
  serverPort: number;
  // サーバー起動タイムアウト（ミリ秒）
  startTimeout: number;
  // CORSを有効にするかどうか (サーバーがサポートしていれば)
  enableCors: boolean;
}

// 利用可能な実行ファイルを自動検出
function findAvailableBinary(): string {
  // 検索対象のバイナリ名（優先順位順）
  const binaryNames = [
    'llama-server.exe',
    'server.exe',
    'llama-server',
    'llama_server.exe',
    'llama_cpp_server.exe',
    'server'
  ];
  
  const binDir = path.join(process.cwd(), 'bin');
  
  // binディレクトリが存在するか確認
  if (fs.existsSync(binDir)) {
    // ディレクトリ内のファイル一覧
    try {
      const files = fs.readdirSync(binDir);
      
      // 優先順位順にバイナリを探す
      for (const name of binaryNames) {
        if (files.includes(name)) {
          return path.join('bin', name);
        }
      }
      
      // 見つからない場合は.exeで終わるファイルを探す（Windows）
      if (process.platform === 'win32') {
        const exeFiles = files.filter(f => f.endsWith('.exe'));
        if (exeFiles.length > 0) {
          return path.join('bin', exeFiles[0]);
        }
      }
    } catch (err) {
      console.error('Error reading bin directory:', err);
    }
  }
  
  // デフォルトパスを返す
  return process.platform === 'win32' ? 'bin\\llama-server.exe' : './bin/llama-server';
}

// デフォルト設定
export const DEFAULT_LLAMA_CONFIG: LlamaCppConfig = {
  binaryPath: findAvailableBinary(),
  modelPath: path.join(process.cwd(), 'models/gemma-3-12b-it-Q8_0.gguf'),
  contextSize: 4096,
  batchSize: 512,
  threads: Math.max(1, Math.floor(os.cpus().length * 0.75)), // CPUコア数の75%
  gpuLayers: 0, // デフォルトではGPU無効
  serverAddress: '127.0.0.1',
  serverPort: 8080,
  startTimeout: 300000, // 5分（大きなモデル用に延長）
  enableCors: true, // デフォルトでは有効、ただしサーバーがサポートしていれば
};

// llama-serverプロセスの状態管理
let serverProcess: ChildProcess | null = null;
let isServerRunning = false;
let currentConfig: LlamaCppConfig = DEFAULT_LLAMA_CONFIG;
let corsSupported = false; // サーバーがCORSをサポートしているかのフラグ

/**
 * llama.cppバイナリが存在するか確認
 */
export async function checkLlamaBinary(config: LlamaCppConfig = currentConfig): Promise<boolean> {
  try {
    await fs.promises.access(config.binaryPath, fs.constants.X_OK);
    return true;
  } catch (error) {
    console.error(`llama.cpp binary not found or not executable at ${config.binaryPath}`);
    
    // 利用可能なバイナリを探す
    try {
      const binDir = path.join(process.cwd(), 'bin');
      if (fs.existsSync(binDir)) {
        const files = await fs.promises.readdir(binDir);
        const exeFiles = files.filter(f => 
          f.endsWith('.exe') || 
          (!f.endsWith('.dll') && !f.endsWith('.md') && !f.includes('.'))
        );
        
        if (exeFiles.length > 0) {
          console.log('Available executable files:');
          exeFiles.forEach(file => console.log(`- ${file}`));
          
          // 最初の実行可能ファイルを使用
          const firstExe = path.join(binDir, exeFiles[0]);
          console.log(`Will try to use: ${firstExe}`);
          
          // 設定を更新
          currentConfig.binaryPath = firstExe;
          
          // 実行権限を確認
          if (process.platform !== 'win32') {
            await fs.promises.chmod(firstExe, 0o755);
          }
          
          return true;
        }
      }
    } catch (err) {
      console.error('Error searching for binary files:', err);
    }
    
    return false;
  }
}

/**
 * モデルファイルが存在するか確認
 */
export async function checkModelFile(config: LlamaCppConfig = currentConfig): Promise<boolean> {
  try {
    await fs.promises.access(config.modelPath, fs.constants.R_OK);
    return true;
  } catch (error) {
    console.error(`Model file not found or not readable at ${config.modelPath}`);
    
    // モデルディレクトリ内の利用可能なモデルを検索
    try {
      const modelsDir = path.join(process.cwd(), 'models');
      const files = await fs.promises.readdir(modelsDir);
      
      // .ggufまたは.binファイルを探す
      const modelFiles = files.filter(file => file.endsWith('.gguf') || file.endsWith('.bin'));
      
      if (modelFiles.length > 0) {
        console.log('Available model files:');
        modelFiles.forEach(file => console.log(`- ${file}`));
        
        // 最初のモデルファイルを使用
        const firstModel = path.join(modelsDir, modelFiles[0]);
        console.log(`Will try to use: ${firstModel}`);
        
        // 設定を更新
        currentConfig.modelPath = firstModel;
        
        // 再度チェック
        await fs.promises.access(firstModel, fs.constants.R_OK);
        return true;
      }
    } catch (err) {
      console.error('Error searching for model files:', err);
    }
    
    return false;
  }
}

/**
 * GPUが利用可能か確認して最適なgpuLayers値を推定
 */
export async function detectGpuCapabilities(): Promise<number> {
  try {
    if (process.platform === 'win32') {
      // Windowsの場合はnvidia-smiを実行
      const { stdout } = await execAsync('nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits');
      const gpuMemoryMB = parseInt(stdout.trim(), 10);
      
      if (isNaN(gpuMemoryMB)) return 0;
      
      // GPUメモリに基づいてレイヤー数を決定
      if (gpuMemoryMB > 24000) return 40; // 24GB以上
      if (gpuMemoryMB > 16000) return 32; // 16GB以上
      if (gpuMemoryMB > 12000) return 24; // 12GB以上
      if (gpuMemoryMB > 8000) return 16;  // 8GB以上
      if (gpuMemoryMB > 6000) return 8;   // 6GB以上
      if (gpuMemoryMB > 4000) return 4;   // 4GB以上
      return 0;
    } else {
      // Linuxの場合
      const { stdout } = await execAsync('nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits');
      const gpuMemoryMB = parseInt(stdout.trim(), 10);
      
      if (isNaN(gpuMemoryMB)) return 0;
      
      // GPUメモリに基づいてレイヤー数を決定（Linux用）
      if (gpuMemoryMB > 24000) return 40; // 24GB以上
      if (gpuMemoryMB > 16000) return 32; // 16GB以上
      if (gpuMemoryMB > 12000) return 24; // 12GB以上
      if (gpuMemoryMB > 8000) return 16;  // 8GB以上
      if (gpuMemoryMB > 6000) return 8;   // 6GB以上
      if (gpuMemoryMB > 4000) return 4;   // 4GB以上
      return 0;
    }
  } catch (error) {
    console.log('No NVIDIA GPU detected or drivers not installed, using CPU only');
    return 0;
  }
}

/**
 * llama-serverのバージョンからCORSサポートを確認
 * 非常に単純化した方法: バージョンに依存せずすべてのオプションを試す
 */
export async function checkCorsSupport(binaryPath: string): Promise<boolean> {
  try {
    // まずllama-serverのヘルプを実行して、オプション一覧を取得
    const { stdout } = await execAsync(`"${binaryPath}" --help`);
    
    // ヘルプ出力にcorsオプションが含まれているか確認
    return stdout.includes('--cors') || stdout.includes('-cors');
  } catch (error) {
    console.warn('Error checking CORS support, assuming not supported:', error);
    return false;
  }
}

/**
 * llama-serverプロセスを起動（リトライロジック付き）
 */
export async function startLlamaServerWithRetry(retries = 2): Promise<boolean> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // 前回のCORSエラーでサーバーが開始できなかった場合、CORSを無効化して試行
      if (attempt > 0 && !isServerRunning) {
        console.log(`Retry attempt ${attempt}: Starting server without CORS option`);
        currentConfig.enableCors = false;
        corsSupported = false;
      }
      
      const result = await startLlamaServer();
      if (result) return true;
      
      // 失敗した場合、次の試行の前に少し待機
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Error in start attempt ${attempt}:`, error);
    }
  }
  
  return false;
}

/**
 * llama-serverプロセスを起動
 */
export async function startLlamaServer(config: Partial<LlamaCppConfig> = {}): Promise<boolean> {
  // すでに実行中なら何もしない
  if (isServerRunning && serverProcess) {
    console.log('llama-server is already running');
    return true;
  }
  
  try {
    // 設定をマージ
    currentConfig = { ...DEFAULT_LLAMA_CONFIG, ...config };
    
    // バイナリとモデルファイルの存在チェック
    const binaryExists = await checkLlamaBinary(currentConfig);
    const modelExists = await checkModelFile(currentConfig);
    
    if (!binaryExists || !modelExists) {
      throw new Error('Required files not found');
    }
    
    // GPU検出（設定で明示的に指定されていない場合）
    if (config.gpuLayers === undefined) {
      currentConfig.gpuLayers = await detectGpuCapabilities();
      console.log(`Auto-detected GPU capabilities: ${currentConfig.gpuLayers} layers`);
    }
    
    // CORSサポートを確認（初回のみ）
    if (corsSupported === false && currentConfig.enableCors) {
      corsSupported = await checkCorsSupport(currentConfig.binaryPath);
      if (!corsSupported) {
        console.log('CORS is not supported by this llama-server version, disabling CORS option');
        currentConfig.enableCors = false;
      }
    }
    
    // llama-serverコマンドの構築
    // 全てのオプションをダブルハイフン形式に統一し、不要なオプションを削除
    const serverArgs = [
      '--model', currentConfig.modelPath,
      '--ctx-size', currentConfig.contextSize.toString(),
      '--batch-size', currentConfig.batchSize.toString(),
      '--threads', currentConfig.threads.toString(),
      '--n-gpu-layers', currentConfig.gpuLayers.toString(),
      '--host', currentConfig.serverAddress,
      '--port', currentConfig.serverPort.toString(),
      '--mlock' // メモリをロックして強制スワップを防止
    ];
    
    // CORSオプションを追加（サポートされている場合のみ）
    if (currentConfig.enableCors && corsSupported) {
      serverArgs.push('--cors', '*');
      console.log('CORS is enabled for llama-server, allowing browser direct access');
    } else {
      console.log('CORS is disabled or not supported by this llama-server version');
    }
    
    console.log(`Starting llama-server with command: ${currentConfig.binaryPath} ${serverArgs.join(' ')}`);
    
    // サーバープロセスを起動
    serverProcess = spawn(currentConfig.binaryPath, serverArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false
    });
    
    // ログ出力
    serverProcess.stdout?.on('data', (data: Buffer) => {
      const logData = data.toString().trim();
      try {
        // JSONとして解析を試みる（JSONでない場合は例外が発生）
        const logJson = JSON.parse(logData);
        console.log(`[llama-server] ${logJson.message || JSON.stringify(logJson)}`);
      } catch (e) {
        // JSONでない場合はそのまま出力
        console.log(`[llama-server] ${logData}`);
      }
    });
    
    serverProcess.stderr?.on('data', (data: Buffer) => {
      console.error(`[llama-server] Error: ${data.toString().trim()}`);
    });
    
    // プロセス終了ハンドラ
    serverProcess.on('exit', (code, signal) => {
      console.log(`llama-server process exited with code ${code} and signal ${signal}`);
      isServerRunning = false;
      serverProcess = null;
    });
    
    // サーバーが起動するのを待つ
    await new Promise<void>((resolve, reject) => {
      let startTimeout: NodeJS.Timeout;
      let lastOutput = '';
      let serverStartDetected = false;
      let modelLoadedDetected = false;
      let slotsReadyDetected = false;
      
      // 標準出力を監視してサーバー起動を検出
      const onStdout = (data: Buffer) => {
        const output = data.toString();
        lastOutput += output;
        
        // エラーチェック（無効な引数などのエラー）
        if (
          output.includes('error: invalid argument') || 
          output.includes('invalid option') ||
          output.includes('unrecognized option')
        ) {
          let errorMsg = 'Unknown error in server command line';
          
          // エラーメッセージを抽出
          const errorMatch = output.match(/error: (.*)/);
          if (errorMatch) {
            errorMsg = errorMatch[1];
            
            // CORSオプションのエラーを検出
            if (errorMsg.includes('--cors') || errorMsg.includes('-cors')) {
              console.warn('CORS option is not supported by this llama-server version');
              corsSupported = false;
              currentConfig.enableCors = false;
            }
          }
          
          console.error(`Error starting llama-server: ${errorMsg}`);
          serverProcess?.stdout?.removeListener('data', onStdout);
          clearTimeout(startTimeout);
          reject(new Error(errorMsg));
          return;
        }
        
        // サーバー起動検出条件（複数の可能性をチェック）
        if (
          output.includes('server listening') || 
          output.includes('Server listening') ||
          output.includes('HTTP server is listening') ||
          output.includes('main: server is listening') ||
          (output.includes('listening') && output.includes('http://'))
        ) {
          serverStartDetected = true;
          console.log('[llama-server] Server start detected');
        }
        
        // モデル読み込み完了を検出
        if (
          output.includes('model loaded') || 
          output.includes('main: model loaded')
        ) {
          modelLoadedDetected = true;
          console.log('[llama-server] Model loading completed');
        }
        
        // スロット準備完了を検出
        if (
          output.includes('all slots are idle') || 
          output.includes('update_slots: all slots are idle') ||
          output.includes('main loop') ||
          output.includes('starting the main loop')
        ) {
          slotsReadyDetected = true;
          console.log('[llama-server] Slots are ready');
        }
        
        // 完全な起動状態を検出
        if (
          (serverStartDetected && modelLoadedDetected) || 
          (serverStartDetected && slotsReadyDetected) ||
          (output.includes('model loaded') && output.includes('main: server is listening')) ||
          (output.includes('all slots are idle'))
        ) {
          console.log('[llama-server] Server is fully initialized');
          serverProcess?.stdout?.removeListener('data', onStdout);
          clearTimeout(startTimeout);
          resolve();
        }
      };
      
      serverProcess?.stdout?.on('data', onStdout);
      
      // タイムアウト設定（大きなモデル用に延長）
      startTimeout = setTimeout(() => {
        serverProcess?.stdout?.removeListener('data', onStdout);
        
        // サーバーが起動している可能性が高い場合は続行
        if (serverStartDetected || modelLoadedDetected || slotsReadyDetected) {
          console.log('[llama-server] Server appears to be running, continuing despite no explicit completion message');
          resolve();
        } else {
          console.error('[llama-server] Timeout waiting for server start. Last output:');
          console.error(lastOutput);
          reject(new Error('Timeout waiting for llama-server to start'));
        }
      }, currentConfig.startTimeout);
      
      // エラーハンドリング
      serverProcess?.on('error', (err) => {
        clearTimeout(startTimeout);
        serverProcess?.stdout?.removeListener('data', onStdout);
        reject(err);
      });
    });
    
    // サーバー起動後、APIが応答するまで少し待機
    console.log('[llama-server] Waiting for API to become responsive...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    isServerRunning = true;
    console.log(`llama-server started successfully on ${currentConfig.serverAddress}:${currentConfig.serverPort}`);
    
    // CORSが有効化されているかどうかを通知
    if (currentConfig.enableCors && corsSupported) {
      console.log(`CORS is enabled. Browser clients can directly access llama-server at http://${currentConfig.serverAddress}:${currentConfig.serverPort}`);
    } else {
      console.log(`CORS is disabled or not supported. Browser clients must use the API proxy.`);
    }
    
    return true;
  } catch (error) {
    console.error('Error starting llama-server:', error);
    
    // エラー時にはプロセスをクリーンアップ
    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
    }
    
    isServerRunning = false;
    return false;
  }
}

/**
 * llama-serverプロセスを停止
 */
export async function stopLlamaServer(): Promise<boolean> {
  if (!isServerRunning || !serverProcess) {
    console.log('llama-server is not running');
    return true;
  }
  
  try {
    console.log('Stopping llama-server...');
    
    // プロセスを終了
    serverProcess.kill();
    
    // プロセスが終了するのを待つ（最大5秒）
    await Promise.race([
      once(serverProcess, 'exit'),
      new Promise(resolve => setTimeout(resolve, 5000))
    ]);
    
    // プロセスがまだ終了していない場合は強制終了
    if (serverProcess.exitCode === null) {
      console.log('Forcing llama-server process to terminate');
      serverProcess.kill('SIGKILL');
      await once(serverProcess, 'exit');
    }
    
    serverProcess = null;
    isServerRunning = false;
    console.log('llama-server stopped successfully');
    return true;
  } catch (error) {
    console.error('Error stopping llama-server:', error);
    return false;
  }
}

/**
 * llama-serverが実行中かどうかを確認
 */
export function isLlamaServerRunning(): boolean {
  return isServerRunning && serverProcess !== null;
}

/**
 * llama-serverのAPIエンドポイントを取得
 */
export function getLlamaServerEndpoint(): string {
  return `http://${currentConfig.serverAddress}:${currentConfig.serverPort}`;
}

/**
 * llama-serverのCORS設定状態を取得
 */
export function isCorsEnabled(): boolean {
  return currentConfig.enableCors && corsSupported;
}

/**
 * 生成リクエストを送信するためのAPIパラメータ型
 */
export interface LlamaCompletionParams {
  prompt: string;
  temperature: number;
  top_p: number;
  top_k: number;
  max_tokens: number;
  stop?: string[];
  stream?: boolean;
  repeat_penalty?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
}