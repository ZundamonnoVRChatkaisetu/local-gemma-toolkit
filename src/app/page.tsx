import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-8">Local Gemma Toolkit</h1>
      <p className="text-xl mb-12 text-center max-w-2xl">
        Privacy-focused AI applications powered by Gemma 27B (6B quantized)
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
        <Link href="/chat" className="p-6 border rounded-lg hover:bg-gray-100 transition-colors">
          <h2 className="text-2xl font-semibold mb-2">Chat</h2>
          <p>Interact with Gemma in a natural conversation</p>
        </Link>
        
        <Link href="/search" className="p-6 border rounded-lg hover:bg-gray-100 transition-colors">
          <h2 className="text-2xl font-semibold mb-2">DeepSearch</h2>
          <p>Search and analyze your documents with AI</p>
        </Link>
        
        <Link href="/learn" className="p-6 border rounded-lg hover:bg-gray-100 transition-colors">
          <h2 className="text-2xl font-semibold mb-2">Learning Platform</h2>
          <p>Personalized learning with privacy protection</p>
        </Link>
        
        <Link href="/security" className="p-6 border rounded-lg hover:bg-gray-100 transition-colors">
          <h2 className="text-2xl font-semibold mb-2">Security</h2>
          <p>AI-driven security monitoring and analysis</p>
        </Link>
      </div>
    </main>
  );
}
