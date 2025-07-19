'use client';

import { useState } from 'react';
import useSWR from 'swr';

interface SearchResult {
  entities: Array<{
    name: string;
    description: string;
    category: string;
    source?: string;
    url?: string;
  }>;
  source: string;
  confidence: string;
  total: number;
}

interface SearchResultsProps {
  query: string;
  userId?: string;
}

// Skeleton loader component
const SkeletonLoader = () => (
  <div className="space-y-4 animate-pulse">
    {[1, 2, 3].map((i) => (
      <div key={i} className="border rounded-lg p-4">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
        <div className="h-3 bg-gray-200 rounded w-full mb-1"></div>
        <div className="h-3 bg-gray-200 rounded w-2/3"></div>
      </div>
    ))}
  </div>
);

export default function SearchResults({ query, userId }: SearchResultsProps) {
  const [isSearching, setIsSearching] = useState(false);

  const { data, error, isLoading, mutate } = useSWR<SearchResult>(
    query ? `search-${query}-${userId || 'default'}` : null,
    async () => {
      setIsSearching(true);
      try {
        const response = await fetch('/api/get-answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, userId }),
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return response.json();
      } finally {
        setIsSearching(false);
      }
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 300000, // 5 minutes
      keepPreviousData: true
    }
  );

  if (isLoading || isSearching) {
    return <SkeletonLoader />;
  }

  if (error) {
    return (
      <div className="text-red-500 p-4 border rounded-lg">
        <p>Error loading results: {error.message}</p>
        <button 
          onClick={() => mutate()} 
          className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data || data.entities.length === 0) {
    return (
      <div className="text-gray-500 p-4 border rounded-lg">
        <p>No results found for &quot;{query}&quot;</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>Found {data.total} results</span>
        <span className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded text-xs ${
            data.source === 'helixdb' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
          }`}>
            {data.source === 'helixdb' ? 'Cached' : 'Web Search'}
          </span>
          <span className="capitalize">{data.confidence} confidence</span>
        </span>
      </div>
      
      {data.entities.map((entity, index) => (
        <div key={index} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
          <h3 className="font-semibold text-lg mb-2">{entity.name}</h3>
          <p className="text-gray-600 mb-2">{entity.description}</p>
          <div className="flex items-center gap-2 text-sm">
            <span className="capitalize text-gray-500">{entity.category}</span>
            {entity.url && (
              <a 
                href={entity.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                View source
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
} 