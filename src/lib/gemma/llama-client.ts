/**
 * llama.cppサーバーとの通信を担当するクライアント
 */

import fetch from 'node-fetch';
import { getLlamaServerEndpoint, LlamaCompletionParams, isLlamaServerRunning } from './llama-cpp';
import { Message } from '.';

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
  if (!isLlamaServerRunning()) {
    throw new Error('llama-server is not running');
  }
  
  try {
    const endpoint = `${getLlamaServerEndpoint()}/completion`;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`llama-server returned status ${response.status}: ${errorText}`);
    }
    
    const data = await response.json() as LlamaCompletionResponse;
    return data.content;
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
  if (!isLlamaServerRunning()) {
    throw new Error('llama-server is not running');
  }
  
  try {
    const endpoint = `${getLlamaServerEndpoint()}/completion`;
    
    // stream: trueを明示的に設定
    const requestParams = {
      ...params,
      stream: true,
    };
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestParams),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`llama-server returned status ${response.status}: ${errorText}`);
    }
    
    // レスポンスがストリームであるため、body.getReader()を使用
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Failed to get reader from response');
    
    const decoder = new TextDecoder();
    let buffer = '';
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        // 受信したデータをデコード
        const chunk = decoder.decode(value, { stream: true });
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
            } catch (innerError) {
              console.error('Error processing stream chunk:', innerError);
              throw innerError;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
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
  if (!isLlamaServerRunning()) {
    throw new Error('llama-server is not running');
  }
  
  try {
    const endpoint = `${getLlamaServerEndpoint()}/model`;
    
    const response = await fetch(endpoint, {
      method: 'GET',
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`llama-server returned status ${response.status}: ${errorText}`);
    }
    
    return await response.json();
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
    return '申し訳ありません。リクエストの処理中にエラーが発生しました。もう一度お試しください。';
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
    yield '申し訳ありません。リクエストの処理中にエラーが発生しました。もう一度お試しください。';
  }
}