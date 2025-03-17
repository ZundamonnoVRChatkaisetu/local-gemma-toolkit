import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { SearchResult } from '@/lib/search';

interface SearchResultsProps {
  results: SearchResult[];
  query: string;
  isLoading?: boolean;
}

export function SearchResults({ results, query, isLoading = false }: SearchResultsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Search Results</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, index) => (
              <div key={index} className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2 mb-1"></div>
                <div className="h-3 bg-gray-200 rounded w-full"></div>
              </div>
            ))}
          </div>
        ) : results.length > 0 ? (
          <div className="space-y-6">
            {results.map((result, index) => (
              <div key={index} className="border-b pb-4 last:border-b-0 last:pb-0">
                <h3 className="font-medium mb-1">{result.documentTitle}</h3>
                <p className="text-sm text-gray-500 mb-2">
                  Match score: {(result.similarity * 100).toFixed(2)}%
                </p>
                <p className="text-sm">
                  {highlightMatchingText(result.chunkText, query)}
                </p>
              </div>
            ))}
          </div>
        ) : query ? (
          <p>No results found for "{query}". Try a different search term.</p>
        ) : (
          <p>Type a search query to find content in your documents.</p>
        )}
      </CardContent>
    </Card>
  );
}

// Helper function to highlight matching text (simplified)
function highlightMatchingText(text: string, query: string): React.ReactNode {
  if (!query) return text;
  
  try {
    // Very simple implementation - in production would use better matching
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    
    return (
      <>
        {parts.map((part, i) => 
          part.toLowerCase() === query.toLowerCase() ? 
            <span key={i} className="bg-yellow-200">{part}</span> : 
            part
        )}
      </>
    );
  } catch (e) {
    // If regex fails, just return the original text
    return text;
  }
}
