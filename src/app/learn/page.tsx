import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Learning Platform | Local Gemma Toolkit',
  description: 'Privacy-focused learning platform powered by Gemma LLM',
};

export default function LearnPage() {
  return (
    <div className="flex flex-col h-screen">
      <header className="p-4 border-b">
        <h1 className="text-2xl font-bold">Learning Platform</h1>
        <p className="text-sm text-gray-500">
          Personalized learning with complete privacy protection
        </p>
      </header>
      
      <main className="flex-1 overflow-auto p-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border rounded-lg p-6 bg-blue-50">
              <h2 className="text-xl font-semibold mb-4">Create Learning Session</h2>
              <p className="mb-4">
                Start a new personalized learning session on any subject.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block mb-2 text-sm font-medium">Session Title</label>
                  <input 
                    type="text" 
                    className="w-full p-2 border rounded" 
                    placeholder="E.g., English Vocabulary"
                  />
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium">Subject</label>
                  <input 
                    type="text" 
                    className="w-full p-2 border rounded" 
                    placeholder="E.g., English language"
                  />
                </div>
                <button className="px-4 py-2 bg-blue-500 text-white rounded">
                  Create Session
                </button>
              </div>
            </div>
            
            <div className="border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Recent Sessions</h2>
              <p className="text-gray-500 mb-4">
                Continue from where you left off in your previous sessions.
              </p>
              <div className="space-y-2">
                <div className="p-3 border rounded hover:bg-gray-50 cursor-pointer">
                  <h3 className="font-medium">English Vocabulary</h3>
                  <p className="text-sm text-gray-500">Last studied: 2 days ago</p>
                </div>
                <div className="p-3 border rounded hover:bg-gray-50 cursor-pointer">
                  <h3 className="font-medium">JavaScript Basics</h3>
                  <p className="text-sm text-gray-500">Last studied: 5 days ago</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">How It Works</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border rounded">
                <h3 className="font-medium mb-2">1. Create a Session</h3>
                <p className="text-sm">Choose a subject you want to study and create a new learning session.</p>
              </div>
              <div className="p-4 border rounded">
                <h3 className="font-medium mb-2">2. Answer Questions</h3>
                <p className="text-sm">The AI will generate personalized questions based on your performance.</p>
              </div>
              <div className="p-4 border rounded">
                <h3 className="font-medium mb-2">3. Track Progress</h3>
                <p className="text-sm">See your improvement over time with detailed analytics.</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
