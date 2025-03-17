import { Metadata } from 'next';
import { ChatInterface } from '@/components/chat/chat-interface';

export const metadata: Metadata = {
  title: 'Chat | Local Gemma Toolkit',
  description: 'Chat with Gemma 27B (6B quantized) model locally',
};

export default function ChatPage() {
  const initialMessages = [
    { 
      role: 'assistant', 
      content: 'Hello! I\'m Gemma, running locally on your machine. How can I help you today?' 
    },
  ];

  return (
    <div className="flex flex-col h-screen">
      <header className="p-4 border-b">
        <h1 className="text-2xl font-bold">Chat with Gemma</h1>
        <p className="text-sm text-gray-500">
          Powered by Gemma 27B (6B quantized) - Running 100% locally on your device
        </p>
      </header>
      
      <main className="flex-1 overflow-hidden">
        <ChatInterface initialMessages={initialMessages} />
      </main>
    </div>
  );
}
