"use client";

import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from './chat-message';
import { ChatInput } from './chat-input';
import { Message } from '@/lib/gemma';
import { AlertCircle, RefreshCw } from 'lucide-react';

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
  const [corsEnabled, setCorsEnabled] = useState<boolean>(false);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const corsErrorDetectedRef = useRef<boolean>(true); // 常にCORSエラーを検出したと仮定
  const requestInProgressRef = useRef<boolean>(false);

  // スタートアップ時にAPI健全性チェックを実行
  useEffect(() => {
    const checkApiHealth = async () => {
      try {
        console.log('Checking API health...');
        const response = await fetch('/api/chat');
        
        if (!response.ok) {
          console.error(`API health check failed with status ${response.status}`);
          setServerStatus('stopped');
          setError('LLMサーバーとの接続に失敗しました。サーバーがオフラインか、応答していません。');
          return;
        }
        
        const data = await response.json();
        console.log('API health check response:', data);
        
        // 新しいステータス検出ロジック
        if (data.status === 'running') {
          console.log('LLM server is running properly');
          setServerStatus('running');
          setError(null);
        } else if (data.status === 'initializing') {
          console.log('LLM server is initializing');
          setServerStatus('initializing');
          setError('LLMサーバーが初期化中です。しばらくお待ちください...');
        } else {
          console.warn(`LLM server status: ${data.status}`);
          setServerStatus('stopped');
          setError('LLMサーバーが起動していません。再起動が必要です。');
        }
        
        // CORS設定は常に無効に設定
        setCorsEnabled(false);
        corsErrorDetectedRef.current = true;
      } catch (error) {
        console.error('API health check error:', error);
        setServerStatus('unknown');
        setError('APIヘルスチェック中にエラーが発生しました。ネットワーク接続を確認してください。');
      }
    };
    
    checkApiHealth();
    
    // 定期的なヘルスチェック（10秒ごと）
    const intervalId = setInterval(checkApiHealth, 10000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, []);

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

  // 直接APIコールは常に失敗するようにする
  const handleDirectAPICall = async (content: string): Promise<boolean> => {
    console.log('Direct API calls are disabled, using API route instead');
    return false;
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
      
      // 段階的に表示する（ストリーミング効果をシミュレート）
      const chunks = splitIntoChunks(text, 20);
      let accumulatedText = '';
      
      for (const chunk of chunks) {
        accumulatedText += chunk;
        setStreamedContent(accumulatedText);
        // 短い遅延を挿入
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      return text;
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

    // 常にAPI経由で通信
    console.log('Using API route for communication');

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

  const handleServerRefresh = async () => {
    try {
      setError(null);
      
      console.log('Manually refreshing server status...');
      const response = await fetch('/api/llm/initialize');
      
      if (!response.ok) {
        setServerStatus('stopped');
        setError('LLMサーバーとの接続に失敗しました。サーバーがオフラインか、応答していません。');
        return;
      }
      
      const data = await response.json();
      console.log('Server status refresh response:', data);
      
      if (data.status?.isRunning) {
        setServerStatus('running');
        setError(null);
      } else if (data.status?.serverStarting) {
        setServerStatus('initializing');
        setError('LLMサーバーが初期化中です。しばらくお待ちください...');
      } else {
        setServerStatus('stopped');
        setError('LLMサーバーが起動していません。');
      }
    } catch (error) {
      console.error('Server refresh error:', error);
      setServerStatus('unknown');
      setError('サーバーステータスの更新中にエラーが発生しました。');
    }
  };

  const handleInitializeServer = async () => {
    try {
      setError(null);
      setServerStatus('initializing');
      
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
        setServerStatus('stopped');
        setError('LLMサーバーの初期化に失敗しました。');
        return;
      }
      
      const data = await response.json();
      console.log('Server initialization response:', data);
      
      if (data.success) {
        // サーバー起動後に再度ステータスを確認
        setTimeout(handleServerRefresh, 5000);
        setError('LLMサーバーの初期化を開始しました。しばらくお待ちください...');
      } else {
        setServerStatus('stopped');
        setError(`LLMサーバーの初期化に失敗しました: ${data.error || '不明なエラー'}`);
      }
    } catch (error) {
      console.error('Server initialization error:', error);
      setServerStatus('unknown');
      setError('サーバー初期化中にエラーが発生しました。');
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4">
        {/* サーバーステータス表示 */}
        <div className={`mb-4 p-3 border rounded-md flex items-center ${
          serverStatus === 'running' ? 'bg-green-50 border-green-500 text-green-700' :
          serverStatus === 'initializing' ? 'bg-yellow-50 border-yellow-500 text-yellow-700' :
          serverStatus === 'stopped' ? 'bg-red-50 border-red-500 text-red-700' :
          'bg-yellow-50 border-yellow-500 text-yellow-700'
        }`}>
          <div className={`w-3 h-3 rounded-full mr-2 ${
            serverStatus === 'running' ? 'bg-green-500' :
            serverStatus === 'initializing' ? 'bg-yellow-500' :
            serverStatus === 'stopped' ? 'bg-red-500' :
            'bg-yellow-500'
          }`}></div>
          <div className="flex-1">
            {serverStatus === 'running' ? 
              'LLMサーバーが正常に動作しています (API経由でアクセス中)' :
             serverStatus === 'initializing' ? 'LLMサーバーが初期化中です...' :
             serverStatus === 'stopped' ? 'LLMサーバーが停止しています' :
             'LLMサーバーの状態を確認中...'}
          </div>
          <div className="flex space-x-2">
            {serverStatus === 'stopped' && (
              <button 
                onClick={handleInitializeServer}
                className="text-xs bg-blue-500 hover:bg-blue-600 text-white py-1 px-2 rounded"
                title="サーバーを起動"
              >
                起動
              </button>
            )}
            <button 
              onClick={handleServerRefresh}
              className="p-1 hover:bg-gray-100 rounded-full"
              title="ステータスを更新"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
        
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