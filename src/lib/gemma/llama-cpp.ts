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
}

// デフォルト設定
export const DEFAULT_LLAMA_CONFIG: LlamaCppConfig = {
  binaryPath: process.platform === 'win32' ? 'bin\\llama-server.exe' : './bin/llama-server',
  modelPath: path.join(process.cwd(), 'models/gemma-27b-6b-q4_0.gguf'),
  contextSize: 4096,
  batchSize: 512,
  threads: Math.max(1, Math.floor(os.cpus().length * 0.75)), // CPUコア数の75%
  gpuLayers: 0, // デフォルトではGPU無効
  serverAddress: '127.0.0.1',
  serverPort: 8080
};

// llama-serverプロセスの状態管理
let serverProcess: ChildProcess | null = null;
let isServerRunning = false;
let currentConfig: LlamaCppConfig = DEFAULT_LLAMA_CONFIG;

/**
 * llama.cppバイナリが存在するか確認
 */
export async function checkLlamaBinary(config: LlamaCppConfig = currentConfig): Promise<boolean> {
  try {
    await fs.promises.access(config.binaryPath, fs.constants.X_OK);
    return true;
  } catch (error) {
    console.error(`llama.cpp binary not found or not executable at ${config.binaryPath}`);
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
    
    // llama-serverコマンドの構築
    const serverArgs = [
      '-m', currentConfig.modelPath,
      '-c', currentConfig.contextSize.toString(),
      '-b', currentConfig.batchSize.toString(),
      '-t', currentConfig.threads.toString(),
      '-ngl', currentConfig.gpuLayers.toString(),
      '-host', currentConfig.serverAddress,
      '-p', currentConfig.serverPort.toString(),
      '--mlock', // メモリをロックして強制スワップを防止
      '--log-format', 'json'
    ];
    
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
        // JSON形式のログをパース
        const logJson = JSON.parse(logData);
        console.log(`[llama-server] ${logJson.message}`);
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
      
      // 標準出力を監視してサーバー起動を検出
      const onStdout = (data: Buffer) => {
        const output = data.toString();
        if (output.includes('server listening')) {
          serverProcess?.stdout?.removeListener('data', onStdout);
          clearTimeout(startTimeout);
          resolve();
        }
      };
      
      serverProcess?.stdout?.on('data', onStdout);
      
      // 30秒でタイムアウト
      startTimeout = setTimeout(() => {
        serverProcess?.stdout?.removeListener('data', onStdout);
        reject(new Error('Timeout waiting for llama-server to start'));
      }, 30000);
      
      // エラーハンドリング
      serverProcess?.on('error', (err) => {
        clearTimeout(startTimeout);
        serverProcess?.stdout?.removeListener('data', onStdout);
        reject(err);
      });
    });
    
    // サーバー起動後、APIが応答するまで少し待機
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    isServerRunning = true;
    console.log(`llama-server started successfully on ${currentConfig.serverAddress}:${currentConfig.serverPort}`);
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
