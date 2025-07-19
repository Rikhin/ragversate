'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function BeginButton() {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [progress, setProgress] = useState(0);
  const router = useRouter();

  const handleBegin = async () => {
    setIsOptimizing(true);
    setProgress(0);

    try {
      // Simulate optimization steps
      const steps = [
        'Loading popular entities...',
        'Cleaning up old entries...',
        'Pre-fetching popular entities...',
        'Warming HelixDB cache...',
        'System health check...',
        'Optimization complete!'
      ];

      for (let i = 0; i < steps.length; i++) {
        setProgress((i / steps.length) * 100);
        await new Promise(resolve => setTimeout(resolve, 800)); // Simulate work
      }

      setProgress(100);
      await new Promise(resolve => setTimeout(resolve, 500));

      // Navigate to search page
      router.push('/search');
    } catch (error) {
      console.error('Optimization failed:', error);
      setIsOptimizing(false);
      setProgress(0);
    }
  };

  if (isOptimizing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              Optimizing Your Experience
            </h2>
            <p className="text-gray-600 mb-4">
              Loading popular entities and warming up the system...
            </p>
            
            {/* Progress bar */}
            <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            
            <p className="text-sm text-gray-500">
              {Math.round(progress)}% Complete
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center max-w-md mx-4">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">
          Welcome to RAGversate
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          Your intelligent entity search and knowledge retrieval system
        </p>
        
        <button
          onClick={handleBegin}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-8 rounded-lg text-lg transition-colors duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
        >
          Begin
        </button>
        
        <p className="text-sm text-gray-500 mt-4">
          Click to optimize the system and start searching
        </p>
      </div>
    </div>
  );
} 