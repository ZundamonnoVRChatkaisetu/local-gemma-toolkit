/**
 * High-level interface for the Gemma LLM
 * This provides the main API for interacting with the model
 */

import { 
  startLlamaServer, 
  stopLlamaServer, 
  isLlamaServerRunning,
  detectGpuCapabilities,
  LlamaCppConfig,
  DEFAULT_LLAMA_CONFIG,
} from './llama-cpp';

import {
  generateCompletion as llamaGenerateCompletion,
  generateStreamingCompletion as llamaGenerateStreamingCompletion,
  getModelInfo,
  pingLlamaServer
} from './llama-client';

import { Message, ModelParams } from '.';

// デフォルトのモデルパラメータ
const DEFAULT_MODEL_PARAMS: ModelParams = {
  temperature: 0.7,
  top_p: 0.9,
  top_k: 40,
  max_tokens: 2048,
  stream: false,
};

// モデル情報をキャッシュ
let modelInfoCache: any = null;

/**
 * LLMシステムを初期化して起動
 * 503エラーなどの初期化中状態を適切に処理
 */
export async function initializeLLM(config?: Partial<LlamaCppConfig>): Promise<boolean> {
  // 既に実行中かチェック（pingを含めて確認）
  if (isLlamaServerRunning()) {
    try {
      // サーバーが応答するか確認（503も許容）
      const isResponding = await pingLlamaServer(1, 1000);
      if (isResponding) {
        console.log('LLM is already initialized and responding');
        return true;
      } else {
        console.log('LLM process is running but not responding to HTTP requests yet');
      }
    } catch (error) {
      console.warn('Error during health check of running server:', error);
    }
  }
  
  console.log('Initializing Gemma LLM...');
  
  try {
    // GPU機能を自動検出
    if (!config?.gpuLayers) {
      const gpuLayers = await detectGpuCapabilities();
      console.log(`Auto-detected GPU capabilities: ${gpuLayers} layers`);
      config = {
        ...config,
        gpuLayers,
      };
    }
    
    // LLMサーバーを起動
    const started = await startLlamaServer(config);
    if (!started) {
      throw new Error('Failed to start LLM server');
    }
    
    // サーバーが応答するのを待つ（より長いタイムアウトと再試行回数）
    console.log('Waiting for llama-server to become responsive...');
    let serverResponsive = false;
    
    // 起動直後は503エラーが出ることがあるため、より長い待機が必要
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        // 503も成功として扱う
        serverResponsive = await pingLlamaServer(2, 2000);
        if (serverResponsive) {
          console.log(`Server responded on attempt ${attempt + 1}`);
          break;
        }
      } catch (e) {
        console.warn(`Ping attempt ${attempt + 1} failed:`, e);
      }
      
      // 待機時間を徐々に増やす
      const waitTime = 2000 + (attempt * 1000);
      console.log(`Waiting ${waitTime}ms before next attempt...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    // モデル情報をキャッシュ（取得できなくても続行）
    try {
      modelInfoCache = await getModelInfo();
      console.log(`Model initialized: ${modelInfoCache.name}`);
      console.log(`Context length: ${modelInfoCache.modelParams.context_length}`);
    } catch (e) {
      console.warn('Could not fetch model info, continuing anyway:', e);
    }
    
    console.log('Gemma LLM initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing Gemma LLM:', error);
    return false;
  }
}

/**
 * モデル情報を取得
 */
export async function getGemmaModelInfo(): Promise<any> {
  if (modelInfoCache) {
    return modelInfoCache;
  }
  
  // 503エラーを考慮して初期化状態をチェック
  let needsInit = !isLlamaServerRunning();
  if (!needsInit) {
    try {
      // サーバーが応答するか確認
      const isResponding = await pingLlamaServer(1, 1000);
      if (!isResponding) {
        needsInit = true;
      }
    } catch (error) {
      needsInit = true;
    }
  }
  
  if (needsInit) {
    console.log('Server not responsive, initializing before getting model info');
    await initializeLLM();
  }
  
  try {
    modelInfoCache = await getModelInfo();
    return modelInfoCache;
  } catch (error) {
    console.error('Error getting model info:', error);
    throw error;
  }
}

/**
 * LLMシステムをシャットダウン
 */
export async function shutdownLLM(): Promise<boolean> {
  console.log('Shutting down Gemma LLM...');
  
  try {
    await stopLlamaServer();
    modelInfoCache = null;
    console.log('Gemma LLM shut down successfully');
    return true;
  } catch (error) {
    console.error('Error shutting down Gemma LLM:', error);
    return false;
  }
}

/**
 * モデルから補完を生成
 */
export async function generateCompletion(
  messages: Message[],
  params: Partial<ModelParams> = {}
): Promise<string> {
  // LLMが初期化されていることを確認
  if (!isLlamaServerRunning()) {
    console.log('Server not running, initializing...');
    await initializeLLM();
  } else {
    // サーバープロセスは実行中だが、応答しているか確認
    try {
      const isResponding = await pingLlamaServer(1, 1000);
      if (!isResponding) {
        console.log('Server process running but not responsive, attempting initialization...');
        await initializeLLM();
      }
    } catch (error) {
      console.warn('Error checking server health, attempting initialization:', error);
      await initializeLLM();
    }
  }
  
  // デフォルトパラメータとマージ
  const finalParams: ModelParams = { ...DEFAULT_MODEL_PARAMS, ...params };
  
  try {
    // LLMクライアントを使用して補完リクエストを送信
    return await llamaGenerateCompletion(messages, {
      temperature: finalParams.temperature,
      top_p: finalParams.top_p,
      top_k: finalParams.top_k,
      max_tokens: finalParams.max_tokens,
      stop: finalParams.stop_sequences,
    });
  } catch (error) {
    console.error('Error generating completion:', error);
    throw error;
  }
}

/**
 * モデルからストリーミング補完を生成
 */
export async function* streamCompletion(
  messages: Message[],
  params: Partial<ModelParams> = {}
): AsyncGenerator<string, void, unknown> {
  // LLMが初期化されていることを確認
  if (!isLlamaServerRunning()) {
    yield 'サーバーを初期化しています、しばらくお待ちください...';
    await initializeLLM();
  } else {
    // サーバープロセスは実行中だが、応答しているか確認
    try {
      const isResponding = await pingLlamaServer(1, 1000);
      if (!isResponding) {
        yield 'サーバーとの接続を確立しています、しばらくお待ちください...';
        await initializeLLM();
      }
    } catch (error) {
      console.warn('Error checking server health, attempting initialization:', error);
      yield 'サーバー状態を確認中に問題が発生しました、再接続しています...';
      await initializeLLM();
    }
  }
  
  // デフォルトパラメータとマージ
  const finalParams: ModelParams = { 
    ...DEFAULT_MODEL_PARAMS, 
    ...params,
    stream: true 
  };
  
  try {
    // LLMクライアントを使用してストリーミング補完リクエストを送信
    yield* llamaGenerateStreamingCompletion(messages, {
      temperature: finalParams.temperature,
      top_p: finalParams.top_p,
      top_k: finalParams.top_k,
      max_tokens: finalParams.max_tokens,
      stop: finalParams.stop_sequences,
    });
  } catch (error) {
    console.error('Error streaming completion:', error);
    throw error;
  }
}

/**
 * コンテキストサイズを取得
 */
export async function getContextSize(): Promise<number> {
  try {
    const modelInfo = await getGemmaModelInfo();
    return modelInfo?.modelParams?.context_length || DEFAULT_LLAMA_CONFIG.contextSize;
  } catch (e) {
    return DEFAULT_LLAMA_CONFIG.contextSize;
  }
}

/**
 * モデルの現在のメモリ使用量を概算（MB単位）
 * 注意: 実際のメモリ使用量は様々な要因によって変動するため、正確な値ではありません
 */
export function estimateMemoryUsage(): number {
  if (!modelInfoCache) return 0;
  
  // 非常に簡略化した推定値
  const bitsPerWeight = 4; // 量子化後の推定値（Q4_0）
  const layerCount = modelInfoCache?.modelParams?.num_layers || 27;
  const embeddingSize = modelInfoCache?.modelParams?.embedding_length || 4096;
  const vocabSize = modelInfoCache?.modelParams?.vocab_size || 256000;
  
  // 非常に簡略化したメモリ使用量の計算（実際にはもっと複雑）
  const estimatedBytes = (
    // メインモデルパラメータ
    (layerCount * embeddingSize * embeddingSize * bitsPerWeight / 8) + 
    // 埋め込みとボキャブラリ
    (vocabSize * embeddingSize * bitsPerWeight / 8) +
    // KV キャッシュとその他のオーバーヘッド
    (DEFAULT_LLAMA_CONFIG.contextSize * embeddingSize * 4)
  );
  
  return Math.round(estimatedBytes / (1024 * 1024));
}