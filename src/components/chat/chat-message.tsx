import React from 'react';
import { cn } from '@/lib/utils';
import { Message } from '@/lib/gemma';

interface ChatMessageProps {
  message: Message;
  isLoading?: boolean;
}

export function ChatMessage({ message, isLoading = false }: ChatMessageProps) {
  const isUser = message.role === 'user';
  
  return (
    <div 
      className={cn(
        "py-4 px-4 flex",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-3xl rounded-lg px-4 py-3",
          isUser 
            ? "bg-blue-500 text-white" 
            : "bg-gray-100 text-gray-800",
          isLoading && "animate-pulse"
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
}
