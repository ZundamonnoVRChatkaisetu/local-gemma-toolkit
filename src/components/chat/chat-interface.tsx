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
  const [serverStatus, setServerStatus] = useState<'running' | 'stopped' | 'unknown'>('unknown');
  const [corsEnabled, setCorsEnabled] = useState<boolean>(false);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const corsErrorDetectedRef = useRef<boolean>(true); // 常にCORSエラーを検出したと仮定

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
        
        if (data.status === 'running') {
          console.log('LLM server is running properly');
          setServerStatus('running');
          setError(null);
          
          // CORS設定は常に無効に設定
          setCorsEnabled(false);
          corsErrorDetectedRef.current = true;
        } else {
          console.warn(`LLM server status: ${data.status}`);
          setServerStatus('stopped');
          setError('LLMサーバーが起動していません。');
        }
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

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let responseText = '';
    let lastUpdate = Date.now();
    const UPDATE_INTERVAL = 50; // ms

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          // 最終アップデート
          if (responseText.trim()) {
            setStreamedContent(responseText);
          }
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        responseText += chunk;
        
        // 一定間隔でのみUIを更新（パフォーマンス最適化）
        const now = Date.now();
        if (now - lastUpdate > UPDATE_INTERVAL) {
          setStreamedContent(responseText);
          lastUpdate = now;
        }
      }

      return responseText;
    } catch (error) {
      console.error('ストリーミングの読み取り中にエラーが発生しました:', error);
      throw error;
    } finally {
      reader.releaseLock();
    }
  };

  const handleSubmit = async (content: string) => {
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

    // 常にAPI経由で通信
    console.log('Using API route for communication');

    // 新しいAbortControllerを作成
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    try {
      console.log(`🔵 [ChatInterface] Sending POST request to /api/chat...`);
      
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

      console.log(`🔵 [ChatInterface] Received response with status: ${response.status}`);

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
      console.log(`🔵 [ChatInterface] Processing streaming response...`);
      const completionText = await handleStreamedResponse(response);
      console.log(`🔵 [ChatInterface] Stream complete, received text of length: ${completionText.length}`);
      
      if (completionText.trim()) {
        // メッセージリストに追加
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: completionText },
        ]);
      } else {
        // 空のレスポンスの場合、エラーメッセージを表示
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

      console.error('メッセージ送信エラー:', error);
      
      const errorMessage = error instanceof Error 
        ? error.message 
        : '不明なエラーが発生しました';
      
      setError(errorMessage);
      
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
      const response = await fetch('/api/chat');
      
      if (!response.ok) {
        setServerStatus('stopped');
        setError('LLMサーバーとの接続に失敗しました。サーバーがオフラインか、応答していません。');
        return;
      }
      
      const data = await response.json();
      
      if (data.status === 'running') {
        setServerStatus('running');
        setError(null);
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

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4">
        {/* サーバーステータス表示 */}
        <div className={`mb-4 p-3 border rounded-md flex items-center ${
          serverStatus === 'running' ? 'bg-green-50 border-green-500 text-green-700' :
          serverStatus === 'stopped' ? 'bg-red-50 border-red-500 text-red-700' :
          'bg-yellow-50 border-yellow-500 text-yellow-700'
        }`}>
          <div className={`w-3 h-3 rounded-full mr-2 ${
            serverStatus === 'running' ? 'bg-green-500' :
            serverStatus === 'stopped' ? 'bg-red-500' :
            'bg-yellow-500'
          }`}></div>
          <div className="flex-1">
            {serverStatus === 'running' ? 
              'LLMサーバーが正常に動作しています (API経由でアクセス中)' :
             serverStatus === 'stopped' ? 'LLMサーバーが停止しています' :
             'LLMサーバーの状態を確認中...'}
          </div>
          <button 
            onClick={handleServerRefresh}
            className="p-1 hover:bg-gray-100 rounded-full"
            title="ステータスを更新"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        
        {/* エラーメッセージを表示 */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
              <p className="text-sm text-red-600">
                エラーが発生しました: {error}
              </p>
            </div>
            <button 
              onClick={handleRetry}
              className="mt-2 text-sm text-blue-600 hover:underline"
            >
              再試行する
            </button>
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
        onCancel={() => {
          if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setIsLoading(false);
          }
        }}
      />
    </div>
  );
}