'use client';

import { useState } from 'react';
import SearchResults from '../components/SearchResults';

interface SearchResult {
  answer: string;
  source: string;
  cached: boolean;
  performance: {
    totalTime: number;
    toolTime: Record<string, number>;
  };
  reasoning: string;
  toolUsage: Array<{
    tool: string;
    action: string;
    parameters: Record<string, unknown>;
    startTime: number;
    endTime: number;
    duration: number;
    success: boolean;
    result?: Record<string, unknown>;
    error?: string;
  }>;
  agentDecisions: Array<{
    tool: string;
    reason: string;
    confidence: number;
    executed: boolean;
    result?: Record<string, unknown>;
    evaluation?: {
      quality: string;
      confidence: number;
      issues: string[];
      suggestions: string[];
      shouldRetry: boolean;
      reasoning: string;
    };
  }>;
  evaluation: {
    quality: string;
    confidence: number;
    issues: string[];
    suggestions: string[];
    shouldRetry: boolean;
    reasoning: string;
  };
  followUpQuestions?: string[];
  requestId?: string;
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/get-answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: query.trim() }),
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            RAGversate Search
          </h1>
          <p className="text-lg text-gray-600">
            Intelligent AI-powered search with agentic capabilities
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex gap-4">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Ask me anything..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSearch}
              disabled={isLoading || !query.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
            <p className="text-red-800">Error: {error}</p>
          </div>
        )}

        <SearchResults 
          result={result} 
          isLoading={isLoading} 
          error={error}
        />
      </div>
    </div>
  );
} 