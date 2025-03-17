import { Metadata } from 'next';
import { DocumentUpload } from '@/components/search/document-upload';
import { SearchResults } from '@/components/search/search-results';

export const metadata: Metadata = {
  title: 'DeepSearch | Local Gemma Toolkit',
  description: 'Search your local documents with Gemma-powered semantic search',
};

export default function SearchPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">DeepSearch</h1>
        <p className="text-gray-500">
          Search your documents with Gemma-powered semantic understanding
        </p>
      </div>
      
      <div className="mb-8">
        <div className="relative max-w-3xl mx-auto">
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
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          <DocumentUpload />
        </div>
        
        <div className="md:col-span-2">
          <SearchResults 
            results={[]} 
            query="" 
          />
        </div>
      </div>
    </div>
  );
}
