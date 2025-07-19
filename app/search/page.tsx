'use client';

import { useState } from 'react';
import SearchResults from '../components/SearchResults';

interface ToolUsage {
  tool: string;
  action: string;
  parameters: Record<string, unknown>;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  result?: Record<string, unknown>;
  error?: string;
}

interface SearchResult {
  answer: string;
  source: 'helixdb' | 'exa';
  cached: boolean;
  performance: {
    helixdbTime: number;
    exaTime: number;
    totalTime: number;
  };
  reasoning: string;
  toolUsage: ToolUsage[];
  followUpQuestions: string[];
  requestId: string;
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/get-answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query.trim(),
          userId: 'user-' + Math.random().toString(36).substring(2, 10)
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const exampleQueries = [
    "Who is Elon Musk?",
    "Tell me about machine learning",
    "What is artificial intelligence?",
    "Who is Bill Gates?",
    "Explain quantum computing"
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🔍 ragchat Search
          </h1>
          <p className="text-lg text-gray-600">
            Ask anything and watch the AI agent use its tools in real-time
          </p>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="mb-8">
          <div className="flex gap-4">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask me anything..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>

        {/* Example Queries */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">💡 Try these examples:</h3>
          <div className="flex flex-wrap gap-2">
            {exampleQueries.map((example, index) => (
              <button
                key={index}
                onClick={() => setQuery(example)}
                className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <span className="text-red-600 mr-2">❌</span>
              <span className="text-red-800">{error}</span>
            </div>
          </div>
        )}

        {/* Results */}
        <SearchResults result={result} isLoading={isLoading} />

        {/* Live Tool Usage Info */}
        {isLoading && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="text-lg font-semibold text-blue-800 mb-2">🔧 Live Tool Usage</h3>
            <p className="text-blue-700">
              Watch the console for real-time tool usage information as the agent works!
            </p>
            <div className="mt-2 text-sm text-blue-600">
              <p>• Check your browser&apos;s developer console (F12) to see detailed tool logs</p>
              <p>• Each tool call shows parameters, results, and timing</p>
              <p>• Green checkmarks indicate successful tool usage</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 