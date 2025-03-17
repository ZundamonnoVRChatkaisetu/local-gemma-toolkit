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
    <div className="container mx-auto px-4 h-[calc(100vh-9rem)] flex flex-col">
      <div className="py-4">
        <h1 className="text-2xl font-bold">Chat with Gemma</h1>
        <p className="text-sm text-gray-500">
          Powered by Gemma 27B (6B quantized) - Running 100% locally on your device
        </p>
      </div>
      
      <div className="flex-1 overflow-hidden border rounded-lg">
        <ChatInterface initialMessages={initialMessages} />
      </div>
    </div>
  );
}
