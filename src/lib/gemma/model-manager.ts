/**
 * Gemmaモデル管理モジュール
 * モデルファイルの検出、ダウンロード、管理を担当します
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { promisify } from 'util';
import { DEFAULT_LLAMA_CONFIG } from './llama-cpp';

const fsExists = promisify(fs.exists);
const fsReaddir = promisify(fs.readdir);
const fsStat = promisify(fs.stat);
const fsAccess = promisify(fs.access);

// モデル情報の型定義
export interface ModelInfo {
  name: string;
  path: string;
  size: number; // バイト単位
  quantization: string;
  parameters: string;
  contextLength: number;
  lastModified: Date;
}

// モデルのダウンロードオプション
export interface ModelDownloadOptions {
  modelName: string;
  quantization: string;
  url: string;
  showProgress: boolean;
}

/**
 * モデルディレクトリを取得
 */
export function getModelsDirectory(): string {
  return path.join(process.cwd(), 'models');
}

/**
 * モデルディレクトリを作成
 */
export async function ensureModelsDirectory(): Promise<void> {
  const modelsDir = getModelsDirectory();
  
  try {
    await fsAccess(modelsDir);
  } catch (error) {
    // ディレクトリが存在しない場合は作成
    console.log(`Creating models directory at ${modelsDir}`);
    fs.mkdirSync(modelsDir, { recursive: true });
  }
}

/**
 * 利用可能なモデルをスキャン
 */
export async function scanAvailableModels(): Promise<ModelInfo[]> {
  await ensureModelsDirectory();
  const modelsDir = getModelsDirectory();
  
  try {
    const files = await fsReaddir(modelsDir);
    const models: ModelInfo[] = [];
    
    for (const file of files) {
      // モデルファイルのみを対象
      if (file.endsWith('.gguf') || file.endsWith('.bin')) {
        const filePath = path.join(modelsDir, file);
        const stats = await fsStat(filePath);
        
        // ファイル名からモデル情報を推測
        const modelNameMatch = file.match(/^([\w-]+)[-_](\d+[bBmM])(?:[-_](?:Q|q)?(\w+))?\./);
        let name = file;
        let parameters = 'unknown';
        let quantization = 'full';
        
        if (modelNameMatch) {
          name = modelNameMatch[1];
          parameters = modelNameMatch[2];
          if (modelNameMatch[3]) {
            quantization = modelNameMatch[3];
          }
        }
        
        models.push({
          name,
          path: filePath,
          size: stats.size,
          quantization,
          parameters,
          contextLength: 4096, // デフォルト値
          lastModified: stats.mtime,
        });
      }
    }
    
    return models;
  } catch (error) {
    console.error('Error scanning models directory:', error);
    return [];
  }
}

/**
 * モデルファイルをダウンロード
 * 注: 実際の実装ではUIでのダウンロード進捗表示などが必要
 */
export async function downloadModel(options: ModelDownloadOptions): Promise<boolean> {
  await ensureModelsDirectory();
  const modelsDir = getModelsDirectory();
  
  const outputPath = path.join(modelsDir, `${options.modelName}-${options.quantization}.gguf`);
  
  try {
    console.log(`Downloading model from ${options.url} to ${outputPath}`);
    
    // wget または curl を使ってファイルをダウンロード
    const cmd = process.platform === 'win32'
      ? `powershell -Command "(New-Object Net.WebClient).DownloadFile('${options.url}', '${outputPath}')"`
      : `curl -L "${options.url}" -o "${outputPath}"`;
    
    execSync(cmd, { stdio: options.showProgress ? 'inherit' : 'ignore' });
    
    console.log('Model download completed');
    return true;
  } catch (error) {
    console.error('Error downloading model:', error);
    // ダウンロードが中断された場合、不完全なファイルを削除
    if (await fsExists(outputPath)) {
      fs.unlinkSync(outputPath);
    }
    return false;
  }
}

/**
 * モデルファイルの整合性を確認
 */
export async function validateModel(modelPath: string): Promise<boolean> {
  try {
    // ファイルが存在するか確認
    if (!await fsExists(modelPath)) {
      console.error(`Model file not found: ${modelPath}`);
      return false;
    }
    
    // ファイルサイズが妥当か確認（空ファイルではないか）
    const stats = await fsStat(modelPath);
    
    if (stats.size < 1024 * 1024) { // 1MB未満のファイルは不正
      console.error(`Model file is too small: ${stats.size} bytes`);
      return false;
    }
    
    // ファイルが読み取り可能か確認
    await fsAccess(modelPath, fs.constants.R_OK);
    
    // GGUFファイルのマジックナンバーを確認（簡易チェック）
    if (modelPath.endsWith('.gguf')) {
      const buffer = Buffer.alloc(4);
      const fd = fs.openSync(modelPath, 'r');
      fs.readSync(fd, buffer, 0, 4, 0);
      fs.closeSync(fd);
      
      // GGUFのマジックナンバー 'GGUF'
      if (buffer.toString('ascii') !== 'GGUF') {
        console.error(`Invalid GGUF file format: ${modelPath}`);
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error validating model:', error);
    return false;
  }
}

/**
 * デフォルトのモデルパスを取得または検索
 */
export async function findDefaultModel(): Promise<string | null> {
  // 設定ファイルで指定されたパスがあれば、それを使用
  const configPath = DEFAULT_LLAMA_CONFIG.modelPath;
  
  if (await fsExists(configPath)) {
    return configPath;
  }
  
  // 指定されたパスが見つからない場合は、利用可能なモデルをスキャン
  const models = await scanAvailableModels();
  
  if (models.length === 0) {
    return null;
  }
  
  // ファイルサイズでソートして最大のものを選択
  const sortedModels = models.sort((a, b) => b.size - a.size);
  return sortedModels[0].path;
}

/**
 * モデルの詳細情報を取得（モデルヘッダー解析）
 * 注: 実際の実装では、llama.cppのメタデータ抽出機能を使用
 */
export async function getModelDetails(modelPath: string): Promise<ModelInfo | null> {
  try {
    if (!await validateModel(modelPath)) {
      return null;
    }
    
    const fileName = path.basename(modelPath);
    const stats = await fsStat(modelPath);
    
    // ファイル名からモデル情報を推測
    const modelNameMatch = fileName.match(/^([\w-]+)[-_](\d+[bBmM])(?:[-_](?:Q|q)?(\w+))?\./);
    let name = fileName;
    let parameters = 'unknown';
    let quantization = 'full';
    
    if (modelNameMatch) {
      name = modelNameMatch[1];
      parameters = modelNameMatch[2];
      if (modelNameMatch[3]) {
        quantization = modelNameMatch[3];
      }
    }
    
    return {
      name,
      path: modelPath,
      size: stats.size,
      quantization,
      parameters,
      contextLength: 4096, // デフォルト値
      lastModified: stats.mtime,
    };
  } catch (error) {
    console.error('Error getting model details:', error);
    return null;
  }
}

/**
 * モデルファイルの推定メモリ要件
 */
export function estimateModelMemoryRequirements(model: ModelInfo): {
  cpu: number; // MB単位
  gpu: number; // MB単位
} {
  // パラメータ数からモデルサイズを推定
  let paramCount = 0;
  
  if (model.parameters.includes('b') || model.parameters.includes('B')) {
    const match = model.parameters.match(/(\d+)/);
    if (match) {
      paramCount = parseInt(match[1], 10) * 1_000_000_000;
    }
  } else if (model.parameters.includes('m') || model.parameters.includes('M')) {
    const match = model.parameters.match(/(\d+)/);
    if (match) {
      paramCount = parseInt(match[1], 10) * 1_000_000;
    }
  }
  
  // 量子化によるサイズ削減を考慮
  let bitsPerWeight = 16; // デフォルト: FP16
  
  if (model.quantization.includes('4_0') || model.quantization.includes('4_K')) {
    bitsPerWeight = 4;
  } else if (model.quantization.includes('5_0') || model.quantization.includes('5_K')) {
    bitsPerWeight = 5;
  } else if (model.quantization.includes('8_0') || model.quantization.includes('8_K')) {
    bitsPerWeight = 8;
  }
  
  // 基本メモリ要件（KVキャッシュなどを含まない）
  const baseMemoryBytes = (paramCount * bitsPerWeight) / 8;
  
  // KVキャッシュと追加のオーバーヘッド
  const kvCacheBytes = model.contextLength * 2 * 4 * (paramCount / 100); // 非常に簡略化した推定値
  
  // CPU使用時の必要メモリ
  const cpuMemoryMB = Math.ceil((baseMemoryBytes + kvCacheBytes) / (1024 * 1024));
  
  // GPU使用時はCPUよりも少し多めに必要（ミラーリングなど）
  const gpuMemoryMB = Math.ceil(cpuMemoryMB * 1.2);
  
  return {
    cpu: cpuMemoryMB,
    gpu: gpuMemoryMB,
  };
}
