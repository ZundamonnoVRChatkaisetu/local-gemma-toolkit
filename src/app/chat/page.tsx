import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Chat | Local Gemma Toolkit',
  description: 'Chat with Gemma 27B (6B quantized) model locally',
};

export default function ChatPage() {
  return (
    <div className="flex flex-col h-screen">
      <header className="p-4 border-b">
        <h1 className="text-2xl font-bold">Chat with Gemma</h1>
      </header>
      
      <main className="flex-1 overflow-auto p-4">
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-gray-500 my-12">
            Chat functionality will be implemented here with streaming responses from the local Gemma model.
          </p>
        </div>
      </main>
      
      <footer className="p-4 border-t">
        <div className="max-w-4xl mx-auto">
          <div className="flex space-x-2">
            <input 
              type="text" 
              className="flex-1 p-2 border rounded" 
              placeholder="Type your message here..."
              disabled
            />
            <button 
              className="px-4 py-2 bg-blue-500 text-white rounded"
              disabled
            >
              Send
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            All conversations happen locally and are stored only on your device.
          </p>
        </div>
      </footer>
    </div>
  );
}
