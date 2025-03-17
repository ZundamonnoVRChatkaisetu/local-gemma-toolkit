/**
 * LLMメモリマネージャー
 * コンテキスト長の管理とトークン使用量の最適化を行います
 */

import { Message } from '.';
import { getContextSize, estimateMemoryUsage } from './llm';

// トークン数を概算するための簡易関数
// 注: これは正確なトークン数ではなく、英語テキストの概算です
function estimateTokenCount(text: string): number {
  // 英語のテキストでは、単語数の約1.3倍がトークン数の目安
  const words = text.split(/\s+/).length;
  return Math.ceil(words * 1.3);
}

// メッセージのトークン数を概算
function estimateMessageTokens(message: Message): number {
  // ロール識別子などのオーバーヘッドを考慮
  const roleOverhead = 4; // ロールによるオーバーヘッド
  return roleOverhead + estimateTokenCount(message.content);
}

/**
 * 会話のトータルトークン数を概算
 */
export function estimateConversationTokens(messages: Message[]): number {
  return messages.reduce((total, message) => {
    return total + estimateMessageTokens(message);
  }, 0);
}

/**
 * 指定されたトークン数に収まるようにメッセージ履歴を削減
 */
export async function trimConversationToFitContext(
  messages: Message[],
  maxTokens?: number
): Promise<Message[]> {
  // システムメッセージを保持するためのリスト
  const systemMessages: Message[] = [];
  
  // 一般メッセージを保持するリスト
  const normalMessages: Message[] = [];
  
  // メッセージを分類
  messages.forEach(message => {
    if (message.role === 'system') {
      systemMessages.push(message);
    } else {
      normalMessages.push(message);
    }
  });
  
  // コンテキスト長からシステムメッセージと応答用のトークンを引いた残りの長さ
  const contextSize = await getContextSize();
  const maxContextTokens = maxTokens || contextSize;
  
  // システムメッセージのトークン数
  const systemTokens = estimateConversationTokens(systemMessages);
  
  // 応答用に予約するトークン数
  const reservedResponseTokens = 1024;
  
  // 一般メッセージが使える最大トークン数
  const availableTokens = maxContextTokens - systemTokens - reservedResponseTokens;
  
  // 一般メッセージが使用するトークン数
  const normalTokens = estimateConversationTokens(normalMessages);
  
  // トークン数が上限を超えていなければそのまま返す
  if (normalTokens <= availableTokens) {
    return [...systemMessages, ...normalMessages];
  }
  
  // 最大数まで古いメッセージから削除
  const trimmedMessages: Message[] = [];
  let usedTokens = 0;
  
  // 新しいメッセージから追加
  for (let i = normalMessages.length - 1; i >= 0; i--) {
    const message = normalMessages[i];
    const messageTokens = estimateMessageTokens(message);
    
    // このメッセージを追加しても上限を超えないか
    if (usedTokens + messageTokens <= availableTokens) {
      trimmedMessages.unshift(message);
      usedTokens += messageTokens;
    } else {
      // 上限を超える場合はここで終了
      break;
    }
  }
  
  // システムメッセージと必要な一般メッセージを結合
  return [...systemMessages, ...trimmedMessages];
}

/**
 * メッセージ履歴を要約して圧縮
 * 注: これは実際のLLMを使用して過去のメッセージを要約します
 */
export async function summarizeConversation(
  messages: Message[],
  summaryFunction: (messagesToSummarize: Message[]) => Promise<string>
): Promise<Message[]> {
  // メッセージが少ない場合は要約しない
  if (messages.length < 8) {
    return messages;
  }
  
  // システムメッセージと最新のメッセージを保持
  const systemMessages = messages.filter(m => m.role === 'system');
  const recentMessages = messages.slice(-4); // 最新の4つのメッセージは維持
  
  // 要約対象のメッセージ
  const messagesToSummarize = messages.slice(
    systemMessages.length,
    messages.length - recentMessages.length
  );
  
  // 要約するメッセージがない場合
  if (messagesToSummarize.length === 0) {
    return messages;
  }
  
  try {
    // 要約を生成
    const summary = await summaryFunction(messagesToSummarize);
    
    // 要約をシステムメッセージとして追加
    const summaryMessage: Message = {
      role: 'system',
      content: `これまでの会話の要約: ${summary}`
    };
    
    // 最終的なメッセージリスト
    return [...systemMessages, summaryMessage, ...recentMessages];
  } catch (error) {
    console.error('Error summarizing conversation:', error);
    return messages; // エラー時は元のメッセージを返す
  }
}

/**
 * メモリ使用量のステータスを取得
 */
export async function getMemoryStatus(): Promise<{
  estimatedMemoryUsage: number;
  availableContextSize: number;
  systemStatus: 'optimal' | 'high' | 'critical';
}> {
  const memoryUsage = estimateMemoryUsage();
  const contextSize = await getContextSize();
  
  // メモリ使用量に基づいてシステムステータスを判定
  let systemStatus: 'optimal' | 'high' | 'critical' = 'optimal';
  
  if (memoryUsage > 12000) {
    systemStatus = 'critical';
  } else if (memoryUsage > 8000) {
    systemStatus = 'high';
  }
  
  return {
    estimatedMemoryUsage: memoryUsage,
    availableContextSize: contextSize,
    systemStatus,
  };
}

/**
 * 会話の自動要約しきい値を計算
 * コンテキストサイズの70%を超えると要約を検討
 */
export async function shouldSummarizeConversation(messages: Message[]): Promise<boolean> {
  const contextSize = await getContextSize();
  const conversationTokens = estimateConversationTokens(messages);
  
  // コンテキストの70%を超えたら要約を検討
  return conversationTokens > (contextSize * 0.7);
}
