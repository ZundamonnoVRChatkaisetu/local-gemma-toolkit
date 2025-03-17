"use client";

import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from './chat-message';
import { ChatInput } from './chat-input';
import { Message } from '@/lib/gemma';
import { AlertCircle } from 'lucide-react';

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
  const messageEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // スタートアップ時にAPI健全性チェックを実行
  useEffect(() => {
    const checkApiHealth = async () => {
      try {
        const response = await fetch('/api/chat');
        if (!response.ok) {
          throw new Error(`API health check failed with status ${response.status}`);
        }
        
        const data = await response.json();
        if (data.status !== 'running') {
          console.warn(`LLM server status: ${data.status}`);
        } else {
          console.log('LLM server is running properly');
        }
      } catch (error) {
        console.error('API health check error:', error);
      }
    };
    
    checkApiHealth();
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

    // 新しいAbortControllerを作成
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    try {
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
      const completionText = await handleStreamedResponse(response);
      
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

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4">
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
