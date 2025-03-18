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
  startLlamaServerWithRetry,
} from './llama-cpp';

import {
  generateCompletion as llamaGenerateCompletion,
  generateStreamingCompletion as llamaGenerateStreamingCompletion,
  getModelInfo,
  pingLlamaServer,
  testServerConnection
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

// サーバー初期化のステータスを追跡
let isInitializingServer = false;
let lastInitAttempt = 0;

/**
 * LLMシステムを初期化して起動
 * 503エラーなどの初期化中状態を適切に処理
 */
export async function initializeLLM(config?: Partial<LlamaCppConfig>): Promise<boolean> {
  // 重複初期化を防ぐ
  if (isInitializingServer) {
    console.log('Another initialization process is already running');
    return false;
  }
  
  // 最短でも5秒間は再初期化しない
  const now = Date.now();
  if (now - lastInitAttempt < 5000) {
    console.log('Initialization was attempted too recently, skipping');
    return false;
  }
  
  lastInitAttempt = now;
  isInitializingServer = true;
  
  try {
    // 既に実行中かチェック（より詳細なテスト）
    if (isLlamaServerRunning()) {
      try {
        // 詳細なサーバー接続テスト
        const serverTest = await testServerConnection();
        if (serverTest.success) {
          console.log(`LLM is already initialized and responding (status: ${serverTest.status})`);
          isInitializingServer = false;
          return true;
        } else {
          console.log('LLM process is running but not responding to HTTP requests yet');
          // プロセスは実行中だが、応答していない場合は終了して再起動
          await stopLlamaServer();
          // 少し待機してから再起動を試みる
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.warn('Error during health check of running server:', error);
        // エラーが発生した場合も既存のプロセスを終了
        await stopLlamaServer();
        // 少し待機してから再起動を試みる
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.log('Initializing Gemma LLM...');
    
    // GPU機能を自動検出
    if (!config?.gpuLayers) {
      const gpuLayers = await detectGpuCapabilities();
      console.log(`Auto-detected GPU capabilities: ${gpuLayers} layers`);
      config = {
        ...config,
        gpuLayers,
      };
    }
    
    // LLMサーバーを起動（コマンドラインオプションエラーに対応した再試行機能付き）
    const started = await startLlamaServerWithRetry(3);
    if (!started) {
      throw new Error('Failed to start LLM server');
    }
    
    // サーバーが応答するのを待つ（より長いタイムアウトと再試行回数）
    console.log('Waiting for llama-server to become responsive...');
    let serverResponsive = false;
    let lastStatus = '';
    
    // 起動直後は503エラーが出ることがあるため、より長い待機が必要
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        // 詳細な接続テストを実行
        const serverTest = await testServerConnection();
        
        if (serverTest.success) {
          serverResponsive = true;
          lastStatus = serverTest.status;
          
          if (serverTest.status === 'running') {
            console.log(`Server is fully initialized on attempt ${attempt + 1}`);
            break;
          } else if (serverTest.status === 'initializing' || serverTest.status === 'starting') {
            console.log(`Server is ${serverTest.status} on attempt ${attempt + 1}, continuing to wait`);
          }
        } else {
          console.warn(`Server test attempt ${attempt + 1} failed: ${serverTest.message}`);
        }
      } catch (e) {
        console.warn(`Server test attempt ${attempt + 1} failed with error:`, e);
      }
      
      // 待機時間を徐々に増やす
      const waitTime = 3000 + (attempt * 1000);
      console.log(`Waiting ${waitTime}ms before next attempt...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    // サーバーが応答しているか最終確認
    if (!serverResponsive) {
      console.warn('After multiple attempts, server is still not fully responsive');
      
      // 再度チェック（最後のチャンス）
      try {
        const finalCheck = await testServerConnection();
        if (finalCheck.success) {
          console.log(`Final check: server is ${finalCheck.status}`);
          serverResponsive = true;
        } else {
          console.error('Final check: server is still not responding properly');
        }
      } catch (e) {
        console.error('Final check failed with error:', e);
      }
    }
    
    if (!serverResponsive) {
      console.error('Server failed to become responsive after multiple attempts');
      // ここでエラーを投げるとプロセスが起動したままになるため、警告のみとする
      console.warn('Continuing despite server not being fully responsive');
    } else {
      console.log(`Server is responding with status: ${lastStatus}`);
    }
    
    // モデル情報をキャッシュ（取得できなくても続行）
    try {
      modelInfoCache = await getModelInfo();
      console.log(`Model initialized: ${modelInfoCache.name || 'Unknown model'}`);
      console.log(`Context length: ${modelInfoCache.modelParams?.context_length || 'Unknown'}`);
    } catch (e) {
      console.warn('Could not fetch model info, continuing anyway:', e);
    }
    
    console.log('Gemma LLM initialization process completed');
    isInitializingServer = false;
    return true;
  } catch (error) {
    console.error('Error initializing Gemma LLM:', error);
    isInitializingServer = false;
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
  
  // サーバーの状態を詳細にチェック
  try {
    const serverTest = await testServerConnection();
    
    if (!serverTest.success) {
      console.log('LLM server not responding, cannot get model info');
      throw new Error('LLMサーバーが応答していません。アプリケーションを再起動してください。');
    }
    
    // サーバーが初期化中の場合は明確なメッセージ
    if (serverTest.status === 'initializing' || serverTest.status === 'starting') {
      console.log('LLM server is still initializing, cannot get model info yet');
      throw new Error('LLMサーバーは初期化中です。しばらく待ってから再試行してください。');
    }
    
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
  
  // 初期化中の場合は少し待機
  if (isInitializingServer) {
    console.log('LLM is still initializing, waiting before shutdown');
    // 最大10秒待機
    for (let i = 0; i < 10; i++) {
      if (!isInitializingServer) break;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // まだ初期化中の場合は警告
    if (isInitializingServer) {
      console.warn('LLM is still initializing after wait, forcing shutdown');
    }
  }
  
  try {
    await stopLlamaServer();
    modelInfoCache = null;
    isInitializingServer = false;
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
  // サーバーの状態を詳細にチェック
  try {
    const serverTest = await testServerConnection();
    
    if (!serverTest.success) {
      console.error('LLM server is not responding to connection tests');
      throw new Error('LLMサーバーが応答していません。アプリケーションを再起動してください。');
    }
    
    // サーバーが初期化中の場合は明確なメッセージ
    if (serverTest.status === 'initializing' || serverTest.status === 'starting') {
      console.warn('LLM server is still initializing, cannot generate completion yet');
      throw new Error('LLMサーバーは初期化中です。しばらく待ってから再試行してください。');
    }
  } catch (error) {
    console.error('Error checking LLM server health:', error);
    throw new Error('LLMサーバーの状態確認中にエラーが発生しました。アプリケーションを再起動してください。');
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
  // サーバーの状態を詳細にチェック
  let serverStatus = 'unknown';
  
  try {
    const serverTest = await testServerConnection();
    
    if (!serverTest.success) {
      yield 'LLMサーバーが応答していません。アプリケーションを再起動してください。';
      throw new Error('LLMサーバーが応答していません');
    }
    
    serverStatus = serverTest.status;
    
    // サーバーが初期化中の場合は待機を提案
    if (serverStatus === 'initializing' || serverStatus === 'starting') {
      yield `LLMサーバーは初期化中です（${serverStatus}）。モデルのロードが完了するまでお待ちください...`;
      
      // 少し待機してから再確認
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const retryTest = await testServerConnection();
      if (retryTest.success && retryTest.status === 'running') {
        yield `サーバーの準備ができました。会話を開始します。`;
        serverStatus = 'running';
      } else {
        yield `サーバーの初期化に時間がかかっています（${retryTest.status || 'unknown'}）。ブラウザを更新するか、アプリケーションを再起動してください。`;
        throw new Error('サーバーの初期化に時間がかかっています');
      }
    }
  } catch (error) {
    console.error('Error checking LLM server status:', error);
    yield 'LLMサーバーの状態確認中にエラーが発生しました。ブラウザを更新するか、アプリケーションを再起動してください。';
    throw error;
  }
  
  // サーバーが完全に初期化されていない場合はここで終了
  if (serverStatus !== 'running') {
    return;
  }
  
  // デフォルトパラメータとマージ
  const finalParams: ModelParams = { 
    ...DEFAULT_MODEL_PARAMS, 
    ...params,
    stream: true 
  };
  
  try {
    // LLMクライアントを使用してストリーミング補完リクエストを送信
    for await (const chunk of llamaGenerateStreamingCompletion(messages, {
      temperature: finalParams.temperature,
      top_p: finalParams.top_p,
      top_k: finalParams.top_k,
      max_tokens: finalParams.max_tokens,
      stop: finalParams.stop_sequences,
    })) {
      yield chunk;
    }
  } catch (error) {
    console.error('Error streaming completion:', error);
    yield `\n\nエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`;
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