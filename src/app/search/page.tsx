import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'DeepSearch | Local Gemma Toolkit',
  description: 'Search your local documents with Gemma-powered semantic search',
};

export default function SearchPage() {
  return (
    <div className="flex flex-col h-screen">
      <header className="p-4 border-b">
        <h1 className="text-2xl font-bold">DeepSearch</h1>
        <p className="text-sm text-gray-500">
          Search your documents with Gemma-powered semantic understanding
        </p>
      </header>
      
      <main className="flex-1 overflow-auto p-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <div className="relative">
              <input 
                type="text" 
                className="w-full p-4 pr-12 border rounded-lg" 
                placeholder="Search your documents..." 
              />
              <button 
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500"
              >
                🔍
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-6">
            <div className="border rounded-lg p-6 bg-gray-50">
              <h2 className="text-xl font-semibold mb-4">Upload Documents</h2>
              <p className="mb-4">Add your documents to enable semantic search.</p>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <p className="mb-2">Drag and drop files here, or click to select</p>
                <button className="px-4 py-2 bg-blue-500 text-white rounded">
                  Select Files
                </button>
              </div>
            </div>
            
            <div className="border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Search Results</h2>
              <p className="text-gray-500">
                Search results will appear here. Try searching for something in your documents.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
