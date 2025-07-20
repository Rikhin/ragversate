'use client';

import { useState } from 'react';

interface ToolUsage {
  tool: string;
  action: string;
  parameters: any;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  result?: any;
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

interface SearchResultsProps {
  result: SearchResult | null;
  isLoading: boolean;
}

export default function SearchResults({ result, isLoading }: SearchResultsProps) {
  const [showToolUsage, setShowToolUsage] = useState(false);

  if (isLoading) {
    return (
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="text-blue-600">Searching...</span>
        </div>
      </div>
    );
  }

  if (!result) {
    return null;
  }

  return (
    <div className="mt-6 space-y-4">
      {/* Main Answer */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              result.source === 'helixdb' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-blue-100 text-blue-800'
            }`}>
              {result.source === 'helixdb' ? '📚 Cached' : '🌐 Web Search'}
            </span>
            {result.cached && (
              <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                ⚡ Instant
              </span>
            )}
          </div>
          <div className="text-sm text-gray-500">
            {result.performance.totalTime}ms
          </div>
        </div>
        
        <p className="text-gray-800 leading-relaxed">{result.answer}</p>
        
        <div className="mt-4 text-sm text-gray-600">
          <p><strong>Reasoning:</strong> {result.reasoning}</p>
        </div>
      </div>

      {/* Tool Usage Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">🔧 Tool Usage</h3>
          <button
            onClick={() => setShowToolUsage(!showToolUsage)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {showToolUsage ? 'Hide Details' : 'Show Details'}
          </button>
        </div>

        {/* Tool Usage Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
          {result.toolUsage.map((usage, index) => (
            <div key={index} className={`p-3 rounded-lg border ${
              usage.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
            }`}>
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{usage.tool}</span>
                <span className={`text-xs px-2 py-1 rounded ${
                  usage.success ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
                }`}>
                  {usage.success ? '✅' : '❌'}
                </span>
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {usage.action} ({usage.duration}ms)
              </div>
            </div>
          ))}
        </div>

        {/* Detailed Tool Usage */}
        {showToolUsage && (
          <div className="space-y-3">
            {result.toolUsage.map((usage, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-800">
                    {index + 1}. {usage.tool}.{usage.action}
                  </h4>
                  <span className={`text-sm px-2 py-1 rounded ${
                    usage.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {usage.duration}ms
                  </span>
                </div>
                
                <div className="text-sm text-gray-600 mb-2">
                  <strong>Parameters:</strong>
                  <pre className="mt-1 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                    {JSON.stringify(usage.parameters, null, 2)}
                  </pre>
                </div>

                {usage.success && usage.result && (
                  <div className="text-sm text-gray-600 mb-2">
                    <strong>Result:</strong>
                    <pre className="mt-1 p-2 bg-green-50 rounded text-xs overflow-x-auto">
                      {JSON.stringify(usage.result, null, 2)}
                    </pre>
                  </div>
                )}

                {!usage.success && usage.error && (
                  <div className="text-sm text-red-600">
                    <strong>Error:</strong> {usage.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Performance Metrics */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 Performance Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{result.performance.totalTime}ms</div>
            <div className="text-sm text-gray-600">Total Time</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{result.performance.helixdbTime}ms</div>
            <div className="text-sm text-gray-600">HelixDB Time</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{result.performance.exaTime}ms</div>
            <div className="text-sm text-gray-600">Web Search Time</div>
          </div>
        </div>
      </div>

      {/* Follow-up Questions */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">💡 Follow-up Questions</h3>
        <div className="space-y-2">
          {result.followUpQuestions.map((question, index) => (
            <div key={index} className="p-3 bg-gray-50 rounded-lg text-gray-700">
              {question}
            </div>
          ))}
        </div>
      </div>

      {/* Request ID */}
      <div className="text-center text-xs text-gray-500">
        Request ID: {result.requestId}
      </div>
    </div>
  );
} 