/**
 * llama.cppサーバーとの通信を担当するクライアント
 */

import fetch from 'node-fetch';
import { getLlamaServerEndpoint, LlamaCompletionParams, isLlamaServerRunning } from './llama-cpp';
import { Message } from '.';

// AbortControllerポリフィルを削除（Next.jsは組み込みのAbortControllerを使用）

// レスポンス型定義
interface LlamaCompletionResponse {
  content: string;
  stop_reason: string;
  model: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface LlamaStreamChunk {
  content: string;
  stop?: boolean;
  error?: string;
}

/**
 * llama.cppサーバーの応答を一定間隔でポーリングして接続確認
 */
export async function pingLlamaServer(maxRetries = 3, retryInterval = 1000): Promise<boolean> {
  try {
    for (let i = 0; i < maxRetries; i++) {
      try {
        console.log(`Attempting to ping llama-server (attempt ${i+1}/${maxRetries})...`);
        
        // 直接エンドポイントを構築（getLlamaServerEndpointを使わない）
        const endpoint = `http://127.0.0.1:8080/health`;
        
        try {
          const response = await fetch(endpoint, { 
            // タイムアウトを追加
            timeout: 2000
          });
          
          if (response.ok) {
            console.log('llama-server is responding to health checks');
            return true;
          }
        } catch (fetchError) {
          console.log(`Fetch error: ${fetchError.message}`);
        }
        
        // モデルエンドポイントも試してみる
        try {
          const modelEndpoint = `http://127.0.0.1:8080/model`;
          const modelResponse = await fetch(modelEndpoint, { 
            timeout: 2000
          });
          
          if (modelResponse.ok) {
            console.log('llama-server is responding to model endpoint');
            return true;
          }
        } catch (modelError) {
          console.log(`Model endpoint error: ${modelError.message}`);
        }
      } catch (error) {
        console.log(`Attempt ${i+1}/${maxRetries}: llama-server not responding yet`);
      }
      
      if (i < maxRetries - 1) {
        console.log(`Waiting ${retryInterval}ms before next attempt...`);
        await new Promise(resolve => setTimeout(resolve, retryInterval));
      }
    }
    
    console.error('llama-server is not responding after multiple attempts');
    return false;
  } catch (error) {
    console.error('Error in pingLlamaServer:', error);
    return false;
  }
}

/**
 * メッセージをllama.cppに適したプロンプト形式に変換
 */
export function formatMessagesForGemma(messages: Message[]): string {
  return messages.map(message => {
    switch (message.role) {
      case 'system':
        return `<start_of_turn>system\n${message.content.trim()}<end_of_turn>\n\n`;
      case 'user':
        return `<start_of_turn>user\n${message.content.trim()}<end_of_turn>\n\n`;
      case 'assistant':
        return `<start_of_turn>model\n${message.content.trim()}<end_of_turn>\n\n`;
      default:
        return `${message.content.trim()}\n\n`;
    }
  }).join('') + '<start_of_turn>model\n';
}

/**
 * llama.cppサーバーに補完リクエストを送信
 */
export async function sendCompletionRequest(params: LlamaCompletionParams): Promise<string> {
  // サーバー起動チェックをURLベースで行う
  try {
    // サーバーが応答するか確認
    const isResponding = await pingLlamaServer(2, 500);
    if (!isResponding) {
      console.error('No response from llama-server, but continuing anyway...');
    }
    
    // 明示的なエンドポイント指定
    const endpoint = `http://127.0.0.1:8080/completion`;
    
    try {
      console.log('Sending completion request to llama-server...');
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
        timeout: 30000
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Server response error: ${response.status} ${errorText}`);
        throw new Error(`llama-server returned status ${response.status}: ${errorText}`);
      }
      
      const data = await response.json() as LlamaCompletionResponse;
      console.log('Received completion response');
      
      return data.content || '応答内容がありませんでした。もう一度お試しください。';
    } catch (error) {
      throw error;
    }
  } catch (error) {
    console.error('Error sending completion request:', error);
    throw error;
  }
}

/**
 * llama.cppサーバーにストリーミングリクエストを送信
 * エラーハンドリングを改善
 */
export async function* sendStreamingCompletionRequest(
  params: LlamaCompletionParams
): AsyncGenerator<string, void, unknown> {
  // サーバー起動チェックをURLベースで行う
  try {
    // サーバーが応答するか確認
    const isResponding = await pingLlamaServer(1, 500);
    if (!isResponding) {
      console.error('No response from llama-server, but continuing anyway...');
    }
    
    // 明示的なエンドポイント指定
    const endpoint = `http://127.0.0.1:8080/completion`;
    
    // stream: trueを明示的に設定
    const requestParams = {
      ...params,
      stream: true,
    };
    
    try {
      console.log('Sending streaming request to llama-server...');
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestParams),
        timeout: 30000
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Server response error: ${response.status} ${errorText}`);
        throw new Error(`llama-server returned status ${response.status}: ${errorText}`);
      }
      
      // レスポンスがストリームであるため、body.getReader()を使用
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Failed to get reader from response');
      
      const decoder = new TextDecoder();
      let buffer = '';
      let receivedSomething = false;
      
      console.log('Starting to read stream...');
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            console.log('Stream reading complete.');
            break;
          }
          
          // 何かデータを受信した
          receivedSomething = true;
          
          // 受信したデータをデコード
          const chunk = decoder.decode(value, { stream: true });
          console.log(`Received chunk: ${chunk.length} bytes`);
          
          buffer += chunk;
          
          // JSONライン形式でデータが送られてくるため、行ごとに処理
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // 最後の不完全な行をバッファに残す
          
          for (const line of lines) {
            if (!line.trim()) continue;
            
            try {
              // エラー発生時のロギングを追加
              const data = JSON.parse(line) as LlamaStreamChunk;
              
              // エラーチェックを追加
              if (data.error) {
                console.error(`Stream error: ${data.error}`);
                throw new Error(data.error);
              }
              
              if (data.content) {
                yield data.content;
              }
              
              if (data.stop) {
                return;
              }
            } catch (e) {
              // JSONパース失敗時のエラーハンドリングを改善
              console.warn('Failed to parse JSON chunk:', line);
              try {
                // 一部のエラーレスポンスが特殊なフォーマットである可能性があるため再試行
                if (line.includes('error') || line.includes('Error')) {
                  const errorMatch = line.match(/"error":\s*"([^"]*)"/i);
                  if (errorMatch && errorMatch[1]) {
                    throw new Error(`Stream error: ${errorMatch[1]}`);
                  }
                }
                
                // <end_of_turn>トークンの処理を追加
                if (line.includes('<end_of_turn>')) {
                  return;
                }
                
                // プレーンテキストの場合もそのまま返す
                if (line.trim() && !line.startsWith('{') && !line.startsWith('[')) {
                  yield line.trim();
                }
              } catch (innerError) {
                console.error('Error processing stream chunk:', innerError);
                throw innerError;
              }
            }
          }
        }
        
        // ストリームが終了したが何も受信しなかった場合
        if (!receivedSomething) {
          console.error('No data received from the server');
          throw new Error('No data received from the server');
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      throw error;
    }
  } catch (error) {
    console.error('Error sending streaming completion request:', error);
    throw error;
  }
}

/**
 * モデル情報を取得
 */
export async function getModelInfo(): Promise<{
  name: string;
  created_at: string;
  modelParams: {
    context_length: number;
    embedding_length: number;
    num_layers: number;
    vocab_size: number;
  }
}> {
  try {
    // 明示的なエンドポイント指定
    const endpoint = `http://127.0.0.1:8080/model`;
    
    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        timeout: 5000
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`llama-server returned status ${response.status}: ${errorText}`);
      }
      
      return await response.json();
    } catch (error) {
      throw error;
    }
  } catch (error) {
    console.error('Error fetching model info:', error);
    throw error;
  }
}

/**
 * メッセージ配列から補完を生成
 */
export async function generateCompletion(
  messages: Message[],
  params: Partial<Omit<LlamaCompletionParams, 'prompt'>> = {}
): Promise<string> {
  // メッセージをGemma用のプロンプト形式に変換
  const prompt = formatMessagesForGemma(messages);
  
  // パラメータをデフォルト値とマージ
  const completionParams: LlamaCompletionParams = {
    prompt,
    temperature: params.temperature ?? 0.7,
    top_p: params.top_p ?? 0.9,
    top_k: params.top_k ?? 40,
    max_tokens: params.max_tokens ?? 2048,
    stop: params.stop ?? ['<end_of_turn>'],
    repeat_penalty: params.repeat_penalty ?? 1.1,
    presence_penalty: params.presence_penalty ?? 0.0,
    frequency_penalty: params.frequency_penalty ?? 0.0,
    stream: false,
  };
  
  try {
    // 補完リクエスト送信
    return await sendCompletionRequest(completionParams);
  } catch (error) {
    console.error('Error in generateCompletion:', error);
    const errorMessage = error instanceof Error 
      ? error.message 
      : '不明なエラーが発生しました';
    return `申し訳ありません。リクエストの処理中にエラーが発生しました: ${errorMessage}`;
  }
}

/**
 * メッセージ配列からストリーミング補完を生成
 */
export async function* generateStreamingCompletion(
  messages: Message[],
  params: Partial<Omit<LlamaCompletionParams, 'prompt'>> = {}
): AsyncGenerator<string, void, unknown> {
  // メッセージをGemma用のプロンプト形式に変換
  const prompt = formatMessagesForGemma(messages);
  
  // パラメータをデフォルト値とマージ
  const completionParams: LlamaCompletionParams = {
    prompt,
    temperature: params.temperature ?? 0.7,
    top_p: params.top_p ?? 0.9,
    top_k: params.top_k ?? 40,
    max_tokens: params.max_tokens ?? 2048,
    stop: params.stop ?? ['<end_of_turn>'],
    repeat_penalty: params.repeat_penalty ?? 1.1,
    presence_penalty: params.presence_penalty ?? 0.0,
    frequency_penalty: params.frequency_penalty ?? 0.0,
    stream: true,
  };
  
  try {
    // ストリーミング補完リクエスト送信
    yield* sendStreamingCompletionRequest(completionParams);
  } catch (error) {
    console.error('Error in generateStreamingCompletion:', error);
    const errorMessage = error instanceof Error 
      ? error.message 
      : '不明なエラーが発生しました';
    yield `申し訳ありません。リクエストの処理中にエラーが発生しました: ${errorMessage}`;
  }
}