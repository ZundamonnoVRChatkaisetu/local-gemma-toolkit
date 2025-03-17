"use client";

import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from './chat-message';
import { ChatInput } from './chat-input';
import { Message } from '@/lib/gemma';

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
  const messageEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        responseText += chunk;
        setStreamedContent(responseText);
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
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `API returned status ${response.status}`
        );
      }

      // ストリーミングレスポンスを処理
      const completionText = await handleStreamedResponse(response);

      // メッセージリストに追加
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: completionText },
      ]);
    } catch (error) {
      // AbortErrorの場合は無視（ユーザーがキャンセルした場合）
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.log('リクエストがキャンセルされました');
        return;
      }

      console.error('メッセージ送信エラー:', error);
      
      // エラーメッセージをアシスタントメッセージとして表示
      setMessages((prev) => [
        ...prev,
        { 
          role: 'assistant', 
          content: '申し訳ありません。リクエストの処理中にエラーが発生しました。もう一度お試しください。' 
        },
      ]);
    } finally {
      setIsLoading(false);
      setStreamedContent('');
      abortControllerRef.current = null;
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4">
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
