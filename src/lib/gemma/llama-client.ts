/**
 * llama.cppサーバーと通信するためのクライアント実装
 * 低レベルのAPIリクエストとレスポンス処理を担当
 */

import fetch from 'node-fetch';
import { Message, ModelParams } from '.';

// サーバーのデフォルトURL
const DEFAULT_SERVER_URL = 'http://127.0.0.1:8080';

// モデル情報のキャッシュ
let modelInfoCache: any = null;

/**
 * llama-serverのヘルスチェックを行う
 * 実行中でなくても、起動中（503）でも成功と判断するように改良
 * 
 * @param attempts 試行回数
 * @param timeout タイムアウト（ミリ秒）
 * @returns 
 */
export async function pingLlamaServer(
  attempts: number = 2,
  timeout: number = 2000
): Promise<boolean> {
  console.log(`Attempting to ping llama-server (attempt 1/${attempts})...`);
  
  // 初回試行
  try {
    const response = await fetch(`${DEFAULT_SERVER_URL}/health`, {
      method: 'GET',
      timeout: timeout
    });
    
    // 200 OK または 503 Service Unavailable（起動中）も成功とみなす
    if (response.ok || response.status === 503) {
      return true;
    }
    
    console.log(`Health check returned status code: ${response.status}`);
  } catch (error) {
    console.log('Fetch error:', error instanceof Error ? error.message : String(error));
    
    // モデルエンドポイントも試してみる（一部のサーバーではhealthが未実装の場合がある）
    try {
      const modelResponse = await fetch(`${DEFAULT_SERVER_URL}/model`, {
        method: 'GET',
        timeout: timeout
      });
      
      if (modelResponse.ok || modelResponse.status === 503) {
        return true;
      }
      
      console.log(`Model endpoint error: ${modelResponse.status}`);
    } catch (modelError) {
      console.log('Model endpoint error:', modelError instanceof Error ? modelError.message : String(modelError));
    }
  }
  
  // 残りの試行
  for (let i = 1; i < attempts; i++) {
    // 待機してから再試行
    const waitTime = 1000 * i; // 徐々に待機時間を増やす
    console.log(`Waiting ${waitTime}ms before next attempt...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    
    console.log(`Attempting to ping llama-server (attempt ${i+1}/${attempts})...`);
    
    try {
      const response = await fetch(`${DEFAULT_SERVER_URL}/health`, {
        method: 'GET',
        timeout: timeout + (i * 1000) // タイムアウトも徐々に増やす
      });
      
      if (response.ok || response.status === 503) {
        return true;
      }
      
      console.log(`Health check returned status code: ${response.status}`);
    } catch (error) {
      console.log('Fetch error:', error instanceof Error ? error.message : String(error));
      
      // モデルエンドポイントも試してみる
      try {
        const modelResponse = await fetch(`${DEFAULT_SERVER_URL}/model`, {
          method: 'GET',
          timeout: timeout + (i * 1000)
        });
        
        if (modelResponse.ok || modelResponse.status === 503) {
          return true;
        }
        
        console.log(`Model endpoint error: ${modelResponse.status}`);
      } catch (modelError) {
        console.log('Model endpoint error:', modelError instanceof Error ? modelError.message : String(modelError));
      }
    }
  }
  
  console.log('llama-server is not responding after multiple attempts');
  return false;
}

/**
 * モデル情報を取得
 */
export async function getModelInfo(): Promise<any> {
  // キャッシュされた情報があれば返す
  if (modelInfoCache) {
    return modelInfoCache;
  }
  
  try {
    // 複数回試行する（再起動直後は503エラーが出ることがある）
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        const response = await fetch(`${DEFAULT_SERVER_URL}/model`, {
          method: 'GET',
          timeout: 5000
        });
        
        // 503はサーバーが初期化中なので再試行
        if (response.status === 503) {
          attempts++;
          if (attempts < maxAttempts) {
            console.log(`Model endpoint returned 503, waiting before retry ${attempts}/${maxAttempts}...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }
        }
        
        if (!response.ok) {
          throw new Error(`Failed to get model info: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        modelInfoCache = data;
        return data;
      } catch (error) {
        attempts++;
        if (attempts >= maxAttempts) {
          throw error;
        }
        
        console.warn(`Error getting model info (attempt ${attempts}/${maxAttempts}):`, error);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    throw new Error('Failed to get model info after multiple attempts');
  } catch (error) {
    console.error('Error getting model info:', error);
    throw error;
  }
}

/**
 * テキスト補完を生成
 */
export async function generateCompletion(
  messages: Message[],
  params: Partial<ModelParams> = {}
): Promise<string> {
  try {
    // チャットメッセージを適切なフォーマットに変換
    const formattedMessages = messages.map(message => ({
      role: message.role,
      content: message.content
    }));
    
    // リクエストボディを構築
    const body = {
      messages: formattedMessages,
      temperature: params.temperature ?? 0.7,
      top_p: params.top_p ?? 0.9,
      top_k: params.top_k ?? 40,
      max_tokens: params.max_tokens ?? 2048,
      stream: false,
      stop: params.stop || [],
    };
    
    // APIリクエスト
    const response = await fetch(`${DEFAULT_SERVER_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      timeout: 60000, // 1分のタイムアウト
    });
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.choices || data.choices.length === 0) {
      throw new Error('No completion choices returned from the server');
    }
    
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Error generating completion:', error);
    throw error;
  }
}

/**
 * ストリーミング形式でテキスト補完を生成
 */
export async function* generateStreamingCompletion(
  messages: Message[],
  params: Partial<ModelParams> = {}
): AsyncGenerator<string, void, unknown> {
  try {
    // チャットメッセージを適切なフォーマットに変換
    const formattedMessages = messages.map(message => ({
      role: message.role,
      content: message.content
    }));
    
    // リクエストボディを構築
    const body = {
      messages: formattedMessages,
      temperature: params.temperature ?? 0.7,
      top_p: params.top_p ?? 0.9,
      top_k: params.top_k ?? 40,
      max_tokens: params.max_tokens ?? 2048,
      stream: true,
      stop: params.stop || [],
    };
    
    // APIリクエスト
    const response = await fetch(`${DEFAULT_SERVER_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      timeout: 30000, // 30秒のタイムアウト
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server returned ${response.status}: ${response.statusText} - ${errorText}`);
    }
    
    if (!response.body) {
      throw new Error('Response body is null');
    }
    
    // TextDecoderでストリームを処理
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    
    let accumulatedData = '';
    let done = false;
    
    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      
      if (done) break;
      
      // デコードしてデータを蓄積
      const chunk = decoder.decode(value, { stream: true });
      accumulatedData += chunk;
      
      // データラインを処理
      const lines = accumulatedData.split('\n');
      accumulatedData = lines.pop() || ''; // 最後の不完全な行を保持
      
      for (const line of lines) {
        if (!line.trim() || line.trim() === 'data: [DONE]') continue;
        
        try {
          const jsonLine = line.replace(/^data: /, '').trim();
          
          if (!jsonLine) continue;
          
          const data = JSON.parse(jsonLine);
          
          if (data.choices && data.choices.length > 0) {
            const content = data.choices[0].delta?.content;
            
            if (content) {
              yield content;
            }
          }
        } catch (e) {
          console.warn('Error parsing JSON from stream:', e);
          // 不完全なJSONでもエラーにせず継続
        }
      }
    }
    
    // 接続をクリーンアップ
    reader.releaseLock();
  } catch (error) {
    console.error('Error in streaming completion:', error);
    throw error;
  }
}

/**
 * サーバーとの接続をテストする
 * より厳密なサーバー接続テストを実行
 */
export async function testServerConnection(): Promise<{
  success: boolean;
  status: 'running' | 'initializing' | 'unavailable';
  message: string;
}> {
  try {
    // 複数エンドポイントで試行
    const endpoints = [
      '/health',
      '/model',
      '/',
    ];
    
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${DEFAULT_SERVER_URL}${endpoint}`, {
          method: 'GET',
          timeout: 3000
        });
        
        if (response.ok) {
          return {
            success: true,
            status: 'running',
            message: `Server is running and responded to ${endpoint}`
          };
        } else if (response.status === 503) {
          return {
            success: true,
            status: 'initializing',
            message: `Server is initializing (status 503) on ${endpoint}`
          };
        }
      } catch (error) {
        // このエンドポイントのエラーは無視して次を試す
        console.warn(`Error testing endpoint ${endpoint}:`, error);
      }
    }
    
    return {
      success: false,
      status: 'unavailable',
      message: 'Could not connect to any server endpoint'
    };
  } catch (error) {
    console.error('Error testing server connection:', error);
    return {
      success: false,
      status: 'unavailable',
      message: error instanceof Error ? error.message : String(error)
    };
  }
}