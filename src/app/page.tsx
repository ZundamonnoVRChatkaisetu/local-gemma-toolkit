import Link from 'next/link';

export default function Home() {
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <section className="text-center mb-16">
        <h1 className="text-4xl font-bold mb-4">Local Gemma Toolkit</h1>
        <p className="text-xl mb-8 max-w-2xl mx-auto">
          Privacy-focused AI applications powered by Gemma 27B (6B quantized)
        </p>
        <p className="text-gray-600 max-w-2xl mx-auto">
          All processing happens locally on your device - your data never leaves your computer
        </p>
      </section>
      
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
        <Link 
          href="/chat"
          className="block p-8 border rounded-lg hover:shadow-md transition-shadow"
        >
          <div className="text-2xl mb-4">💬</div>
          <h2 className="text-2xl font-semibold mb-2">Chat</h2>
          <p className="text-gray-600 mb-4">Have natural conversations with Gemma, running completely on your local machine.</p>
          <span className="text-blue-500 hover:underline">Start chatting →</span>
        </Link>
        
        <Link 
          href="/search"
          className="block p-8 border rounded-lg hover:shadow-md transition-shadow"
        >
          <div className="text-2xl mb-4">🔍</div>
          <h2 className="text-2xl font-semibold mb-2">DeepSearch</h2>
          <p className="text-gray-600 mb-4">Search through your documents with AI-powered semantic understanding.</p>
          <span className="text-blue-500 hover:underline">Start searching →</span>
        </Link>
        
        <Link 
          href="/learn"
          className="block p-8 border rounded-lg hover:shadow-md transition-shadow"
        >
          <div className="text-2xl mb-4">📚</div>
          <h2 className="text-2xl font-semibold mb-2">Learning Platform</h2>
          <p className="text-gray-600 mb-4">Personalized learning with automatic question generation and progress tracking.</p>
          <span className="text-blue-500 hover:underline">Start learning →</span>
        </Link>
        
        <Link 
          href="/security"
          className="block p-8 border rounded-lg hover:shadow-md transition-shadow"
        >
          <div className="text-2xl mb-4">🔒</div>
          <h2 className="text-2xl font-semibold mb-2">Security</h2>
          <p className="text-gray-600 mb-4">AI-driven security monitoring and analysis to keep your system safe.</p>
          <span className="text-blue-500 hover:underline">Check security →</span>
        </Link>
      </section>
      
      <section className="max-w-4xl mx-auto mt-16 p-8 bg-gray-50 rounded-lg">
        <h2 className="text-2xl font-semibold mb-4">About This Project</h2>
        <p className="mb-4">
          The Local Gemma Toolkit is built on Gemma 27B (6B quantized), a powerful language model that runs entirely on your local machine.
          This means your data stays private and secure, as it never leaves your device.
        </p>
        <p>
          All features are designed to work offline, giving you the power of advanced AI without compromising your privacy.
        </p>
      </section>
    </div>
  );
}
