import { Metadata } from 'next';
import { ChatInterface } from '@/components/chat/chat-interface';

export const metadata: Metadata = {
  title: 'チャット | Local Gemma Toolkit',
  description: 'Gemma 27B（6B量子化）モデルとローカルでチャット',
};

export default function ChatPage() {
  const initialMessages = [
    { 
      role: 'assistant', 
      content: 'こんにちは！ローカルマシン上で動作するGemmaです。どのようにお手伝いできますか？' 
    },
  ];

  return (
    <div className="container mx-auto px-4 h-[calc(100vh-9rem)] flex flex-col">
      <div className="py-4">
        <h1 className="text-2xl font-bold">Gemmaとチャット</h1>
        <p className="text-sm text-gray-500">
          Gemma 27B（6B量子化）搭載 - 100％ローカルデバイス上で動作
        </p>
      </div>
      
      <div className="flex-1 overflow-hidden border rounded-lg">
        <ChatInterface initialMessages={initialMessages} />
      </div>
    </div>
  );
}
