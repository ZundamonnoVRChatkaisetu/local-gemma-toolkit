"use client";

import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from './chat-message';
import { ChatInput } from './chat-input';
import { Message } from '@/lib/gemma';
import { AlertCircle } from 'lucide-react';
import { ServerStatusMonitor } from '@/components/server-status-monitor';

interface ChatInterfaceProps {
  initialMessages?: Message[];
  conversationId?: string;
}

export function ChatInterface({ 
  initialMessages = [], 
  conversationId 
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [streamedContent, setStreamedContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState<'running' | 'initializing' | 'stopped' | 'unknown'>('unknown');
  const messageEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestInProgressRef = useRef<boolean>(false);

  // Scroll to bottom when messages change
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamedContent]);

  // クリーンアップ関数
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // APIエンドポイントからサーバーステータスを取得
  const checkServerStatus = async (): Promise<'running' | 'initializing' | 'stopped' | 'unknown'> => {
    try {
      const response = await fetch('/api/llm/status');
      
      if (!response.ok) {
        return 'unknown';
      }
      
      const data = await response.json();
      
      if (data.status === 'running') {
        return 'running';
      } else if (data.status === 'initializing') {
        return 'initializing';
      } else {
        return 'stopped';
      }
    } catch (error) {
      console.error('Error checking server status:', error);
      return 'unknown';
    }
  };

  // JSONレスポンスをパースして処理する関数
  const parseAndExtractCompletion = (text: string): string => {
    try {
      // JSONとして解析を試みる
      const data = JSON.parse(text);
      
      // completionフィールドがあれば、それを返す
      if (data.completion) {
        return data.completion;
      }
      
      // エラーメッセージがあれば、それを返す
      if (data.error) {
        throw new Error(data.error);
      }
      
      // それ以外の場合は元のテキストを返す
      return text;
    } catch (e) {
      // JSON解析に失敗した場合は、元のテキストをそのまま返す
      return text;
    }
  };

  const handleStreamedResponse = async (response: Response) => {
    if (!response.body) {
      throw new Error('レスポンスボディが空です');
    }

    try {
      // cloneしてからテキストとして読み込む
      const clonedResponse = response.clone();
      const text = await clonedResponse.text();
      
      console.log(`🔵 [ChatInterface] Received full response of length: ${text.length}`);
      console.log(`🔵 [ChatInterface] Response preview: ${text.slice(0, 200)}${text.length > 200 ? '...' : ''}`);
      
      // レスポンステキストからcompletionを抽出
      const extractedContent = parseAndExtractCompletion(text);
      console.log(`🔵 [ChatInterface] Extracted content: ${extractedContent.slice(0, 200)}${extractedContent.length > 200 ? '...' : ''}`);
      
      // 段階的に表示する（ストリーミング効果をシミュレート）
      const chunks = splitIntoChunks(extractedContent, 20);
      let accumulatedText = '';
      
      for (const chunk of chunks) {
        accumulatedText += chunk;
        setStreamedContent(accumulatedText);
        // 短い遅延を挿入
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      return extractedContent;
    } catch (error) {
      console.error('🔴 [ChatInterface] Error processing response:', error);
      throw error;
    }
  };
  
  // テキストを指定した数の文字に分割する関数
  const splitIntoChunks = (text: string, chunkSize: number) => {
    const chunks = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.slice(i, i + chunkSize));
    }
    return chunks;
  };

  const handleSubmit = async (content: string) => {
    // 要求が処理中の場合は新しいリクエストをブロック
    if (requestInProgressRef.current) {
      console.log('🔴 [ChatInterface] Request already in progress, ignoring new request');
      return;
    }
    
    // サーバーの状態を確認
    const status = await checkServerStatus();
    setServerStatus(status);
    
    if (status !== 'running') {
      setError('LLMサーバーが実行されていないか、初期化中です。しばらく待ってから再試行してください。');
      return;
    }
    
    console.log(`🔵 [ChatInterface] handleSubmit called with content: ${content}`);
    
    // 既存のリクエストをキャンセル
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setError(null);
    
    // Add user message
    const userMessage: Message = { role: 'user', content };
    setMessages((prev) => [...prev, userMessage]);
    
    // Set loading state
    setIsLoading(true);
    setStreamedContent('');
    requestInProgressRef.current = true;

    // 新しいAbortControllerを作成
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    try {
      console.log(`🔵 [ChatInterface] Sending POST request to /api/chat...`);
      console.log(`🔵 [ChatInterface] Request payload:`, {
        messages: [...messages, userMessage],
        conversationId,
        stream: true,
      });
      
      // リクエストタイムアウトを60秒に設定
      const timeoutId = setTimeout(() => {
        if (abortControllerRef.current) {
          console.log('🔴 [ChatInterface] Request timeout, aborting');
          abortControllerRef.current.abort();
          setError('リクエストがタイムアウトしました。サーバーが応答していません。');
          requestInProgressRef.current = false;
        }
      }, 60000);
      
      // ストリーミングモードでAPIを呼び出す
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          conversationId,
          stream: true,
        }),
        signal,
      });
      
      // タイムアウトをクリア
      clearTimeout(timeoutId);

      console.log(`🔵 [ChatInterface] Received response with status: ${response.status}`);
      console.log(`🔵 [ChatInterface] Response headers:`, Object.fromEntries([...response.headers]));

      if (!response.ok) {
        // エラーレスポンスを処理
        try {
          const errorData = await response.json();
          throw new Error(errorData.error || errorData.details || `API returned status ${response.status}`);
        } catch (jsonError) {
          // JSONパースに失敗した場合はテキストで取得
          const errorText = await response.text();
          throw new Error(errorText || `API returned status ${response.status}`);
        }
      }

      // ストリーミングレスポンスを処理
      console.log(`🔵 [ChatInterface] Processing response...`);
      const completionText = await handleStreamedResponse(response);
      console.log(`🔵 [ChatInterface] Complete, received text of length: ${completionText.length}`);
      
      if (completionText.trim()) {
        // メッセージリストに追加
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: completionText },
        ]);
      } else {
        // 空のレスポンスの場合、エラーメッセージを表示
        console.error('🔴 [ChatInterface] Empty response received');
        setError('応答が空でした。サーバーの状態を確認してください。');
        setMessages((prev) => [
          ...prev,
          { 
            role: 'assistant', 
            content: '申し訳ありません。応答が生成されませんでした。サーバーの状態を確認してください。' 
          },
        ]);
      }
    } catch (error) {
      // AbortErrorの場合は無視（ユーザーがキャンセルした場合）
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.log('リクエストがキャンセルされました');
        return;
      }

      console.error('🔴 [ChatInterface] Message submission error:', error);
      
      const errorMessage = error instanceof Error 
        ? error.message 
        : '不明なエラーが発生しました';
      
      setError(`エラー: ${errorMessage}`);
      
      // エラーメッセージをアシスタントメッセージとして表示
      setMessages((prev) => [
        ...prev,
        { 
          role: 'assistant', 
          content: `申し訳ありません。リクエストの処理中にエラーが発生しました: ${errorMessage}` 
        },
      ]);
    } finally {
      setIsLoading(false);
      setStreamedContent('');
      abortControllerRef.current = null;
      requestInProgressRef.current = false;
    }
  };

  const handleRetry = () => {
    // 最後のユーザーメッセージを取得
    const lastUserMessage = [...messages]
      .reverse()
      .find(message => message.role === 'user');
      
    if (lastUserMessage) {
      // 最後のアシスタントメッセージを削除
      const newMessages = [...messages];
      if (newMessages[newMessages.length - 1].role === 'assistant') {
        newMessages.pop();
      }
      setMessages(newMessages);
      
      // 同じメッセージで再試行
      handleSubmit(lastUserMessage.content);
    }
  };

  const handleInitializeServer = async () => {
    try {
      setError(null);
      
      console.log('Manually initializing server...');
      const response = await fetch('/api/llm/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          autoStart: true,
          forceRestart: true
        }),
      });
      
      if (!response.ok) {
        setError('LLMサーバーの初期化に失敗しました。');
        return;
      }
      
      const data = await response.json();
      console.log('Server initialization response:', data);
      
      if (data.success) {
        setError('LLMサーバーの初期化を開始しました。しばらくお待ちください...');
      } else {
        setError(`LLMサーバーの初期化に失敗しました: ${data.error || '不明なエラー'}`);
      }
    } catch (error) {
      console.error('Server initialization error:', error);
      setError('サーバー初期化中にエラーが発生しました。');
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4">
        {/* サーバーステータスモニター */}
        <ServerStatusMonitor 
          showDetailed={true} 
          className="mb-4"
          onInitialize={handleInitializeServer}
        />
        
        {/* エラーメッセージを表示 */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
              <p className="text-sm text-red-600">
                {error}
              </p>
            </div>
            {serverStatus === 'running' && (
              <button 
                onClick={handleRetry}
                className="mt-2 text-sm text-blue-600 hover:underline"
              >
                再試行する
              </button>
            )}
          </div>
        )}
        
        {/* CORS関連の注意メッセージ */}
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-blue-500 mr-2" />
            <p className="text-sm text-blue-700">
              llama-serverがCORSをサポートしていないため、常にAPIルート経由で通信しています。これは通常の動作であり、エラーではありません。
            </p>
          </div>
        </div>
        
        {/* トラブルシューティング情報 */}
        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-yellow-500 mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-yellow-700 font-medium">
                チャットが応答しない場合の対処法:
              </p>
              <ul className="text-sm text-yellow-700 list-disc pl-5 mt-1">
                <li>数分待ってからもう一度送信してみてください（初回は特に時間がかかります）</li>
                <li>「こんにちは」など短い質問から始めてみてください</li>
                <li>画面を更新してから再度試してみてください</li>
                <li>モデルが読み込み中の場合は、右上の緑色のインジケーターが表示されるまで待ってください</li>
                <li>「起動」ボタンを押して、サーバーの再起動を試してください</li>
              </ul>
            </div>
          </div>
        </div>
        
        {messages.map((message, index) => (
          <ChatMessage 
            key={index} 
            message={message} 
            isLoading={isLoading && index === messages.length - 1}
          />
        ))}
        
        {/* ストリーミング中の内容を表示 */}
        {isLoading && streamedContent && (
          <ChatMessage 
            message={{ role: 'assistant', content: streamedContent }} 
            isLoading={false}
          />
        )}
        
        <div ref={messageEndRef} />
      </div>
      <ChatInput 
        onSubmit={handleSubmit} 
        isLoading={isLoading} 
        disabled={serverStatus !== 'running'}
        onCancel={() => {
          if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setIsLoading(false);
            requestInProgressRef.current = false;
          }
        }}
      />
    </div>
  );
}