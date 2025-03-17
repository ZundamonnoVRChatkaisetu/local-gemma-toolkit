import React, { useState, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Message } from '@/lib/gemma';

interface ChatInputProps {
  onSubmit: (message: string) => void;
  isLoading?: boolean;
}

export function ChatInput({ onSubmit, isLoading = false }: ChatInputProps) {
  const [input, setInput] = useState('');

  const handleSubmit = () => {
    if (input.trim() && !isLoading) {
      onSubmit(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex items-end space-x-2 p-4 border-t">
      <Textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="メッセージを入力してください..."
        className="flex-1 resize-none min-h-[60px] max-h-[200px]"
        disabled={isLoading}
      />
      <Button 
        onClick={handleSubmit} 
        disabled={isLoading || !input.trim()}
      >
        送信
      </Button>
    </div>
  );
}
