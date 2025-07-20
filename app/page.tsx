'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [isWarming, setIsWarming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBegin = async () => {
    setIsWarming(true);
    setError(null);
    try {
      const res = await fetch('/api/warm-caches', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to warm caches');
      const data = await res.json();
      if (!data.success) throw new Error('Cache warming failed');
      router.push('/chat');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsWarming(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
        <h1 className="text-3xl font-bold mb-4 text-gray-900">Welcome to RAGversate</h1>
        <p className="text-gray-600 mb-8">Click begin to optimize and warm all search caches for the fastest, most agentic experience.</p>
        <button
          onClick={handleBegin}
          disabled={isWarming}
          className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold text-lg shadow hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {isWarming ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
              Warming Caches...
            </span>
          ) : (
            'Begin'
          )}
        </button>
        {error && <div className="mt-4 text-red-600 text-sm">{error}</div>}
      </div>
    </div>
  );
}
