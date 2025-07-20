'use client';

import { useState } from 'react';
import ChatInterface from '../components/ChatInterface';
import { SearchMode, ToolUsage } from '../lib/multi-helixdb';

interface ChatResponse {
  response: string;
  mode: SearchMode;
  toolUsage: ToolUsage[];
  performance: {
    totalTime: number;
    toolTime: Record<string, number>;
  };
  reasoning: string;
  agentDecisions: unknown[];
  evaluation: unknown;
  source: string;
  cached: boolean;
}

export default function ChatPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toolUsage, setToolUsage] = useState<ToolUsage[]>([]);
  const [performance, setPerformance] = useState<{ totalTime: number; toolTime: Record<string, number> } | null>(null);
  const [reasoning, setReasoning] = useState<string>('');

  const handleSendMessage = async (message: string, mode: SearchMode): Promise<string> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message, mode }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data: ChatResponse = await response.json();
      setToolUsage(data.toolUsage || []);
      setPerformance(data.performance || null);
      setReasoning(data.reasoning || '');
      return data.response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Left Sidebar: Tool Usage & Performance */}
      <div className="hidden md:block w-1/4 bg-white border-r border-gray-200 p-4">
        <h2 className="text-lg font-semibold mb-4">🔧 Tool Usage</h2>
        {toolUsage.length === 0 ? (
          <div className="text-gray-400 text-sm">No tool usage yet.</div>
        ) : (
          <div className="space-y-2">
            {toolUsage.map((usage, idx) => {
              let icon = '🛠️';
              if (usage.tool === 'llm_summarize') icon = '🤖';
              if (usage.tool === 'helixdb_cache_write') icon = '💾';
              if (usage.tool === 'helixdb_search') icon = '📚';
              if (usage.tool === 'exa_search') icon = '🌐';
              return (
                <div key={idx} className={`p-2 rounded border ${usage.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm flex items-center gap-1">{icon} {usage.tool}</span>
                    <span className={`text-xs px-2 py-1 rounded ${usage.success ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>{usage.success ? '✅' : '❌'}</span>
                  </div>
                  <div className="text-xs text-gray-600 mt-1">{usage.action} ({usage.duration}ms)</div>
                  {usage.result && usage.result.summary && (
                    <div className="text-xs text-gray-500 mt-1"><strong>Summary:</strong> {usage.result.summary}</div>
                  )}
                  {usage.error && (
                    <div className="text-xs text-red-600 mt-1"><strong>Error:</strong> {usage.error}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <h2 className="text-lg font-semibold mt-8 mb-4">📊 Performance</h2>
        {performance ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Total Time</span>
              <span className="font-bold text-blue-600">{performance.totalTime}ms</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">HelixDB Time</span>
              <span className="font-bold text-green-600">{performance.toolTime.helixdb_search || 0}ms</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Web Search Time</span>
              <span className="font-bold text-orange-600">{performance.toolTime.exa_search || 0}ms</span>
            </div>
          </div>
        ) : (
          <div className="text-gray-400 text-sm">No performance data yet.</div>
        )}
        {reasoning && (
          <div className="mt-8 text-xs text-gray-500">
            <strong>Reasoning:</strong> {reasoning}
          </div>
        )}
      </div>
      {/* Center: Chat Interface */}
      <div className="flex-1 flex flex-col">
        <ChatInterface
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          error={error}
        />
      </div>
    </div>
  );
} 