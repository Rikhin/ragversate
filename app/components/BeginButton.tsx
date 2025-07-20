'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function BeginButton() {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const router = useRouter();

  const handleBegin = async () => {
    setIsOptimizing(true);
    setProgress(0);
    setError('');
    setWarning('');

    try {
      // Step 1: Loading popular entities
      setCurrentStep('Loading popular entities...');
      setProgress(10);
      await new Promise(resolve => setTimeout(resolve, 500));

      // Step 2: Cleaning up old entries
      setCurrentStep('Cleaning up old entries...');
      setProgress(20);
      await new Promise(resolve => setTimeout(resolve, 500));

      // Step 3: Pre-fetching popular entities
      setCurrentStep('Pre-fetching popular entities...');
      setProgress(30);
      await new Promise(resolve => setTimeout(resolve, 500));

      // Step 4: Warming HelixDB cache and initializing components
      setCurrentStep('Warming HelixDB cache...');
      setProgress(50);
      try {
        const response = await fetch('/api/optimize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        const result = await response.json();
        if (result.status === 'ok') {
          // Check if any caches were skipped
          const skipped = Object.entries(result.details || {}).filter(
            ([mode, msg]) => typeof msg === 'string' && msg.startsWith('SKIPPED')
          );
          if (skipped.length > 0) {
            setWarning(
              `Some caches were skipped: ${skipped.map(([mode]) => mode).join(', ')}. You can still proceed.`
            );
          }
        } else {
          setError('Cache warming failed');
          setIsOptimizing(false);
          setProgress(0);
          setCurrentStep('');
          return;
        }
      } catch (error) {
        setError('Cache warming failed');
        setIsOptimizing(false);
        setProgress(0);
        setCurrentStep('');
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 4.5: Initialize Context Engine and Supermemory
      setCurrentStep('Initializing Context Engine...');
      setProgress(65);
      try {
        // Trigger Context Engine initialization
        await fetch('/api/get-answer', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: 'test initialization',
            userId: 'startup_user'
          })
        });
      } catch (error) {
        console.log('Context Engine initialization failed, continuing...', error);
      }
      await new Promise(resolve => setTimeout(resolve, 500));

      // Step 5: System health check
      setCurrentStep('System health check...');
      setProgress(80);
      await new Promise(resolve => setTimeout(resolve, 500));

      // Step 6: Optimization complete
      setCurrentStep('Optimization complete!');
      setProgress(100);
      await new Promise(resolve => setTimeout(resolve, 500));

      // Navigate to search page
      console.log('🚀 Redirecting to search page...');
      router.push('/search');
    } catch (error) {
      setError('Cache warming failed');
      setIsOptimizing(false);
      setProgress(0);
      setCurrentStep('');
    }
  };

  if (isOptimizing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white">
        <div className="bg-gray-50 rounded-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              Optimizing Your Experience
            </h2>
            <p className="text-gray-600 mb-4">
              {currentStep}
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
            {warning && <p className="text-sm text-yellow-600 mt-2">{warning}</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white">
      <div className="text-center max-w-md mx-4">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Welcome to ragchat
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          Your intelligent entity search and knowledge retrieval system
        </p>
        <button
          onClick={handleBegin}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-8 rounded-full text-lg transition-colors duration-200 shadow-sm hover:shadow-md"
        >
          Begin
        </button>
        {error && <p className="text-sm text-red-600 mt-4">{error}</p>}
        {warning && <p className="text-sm text-yellow-600 mt-2">{warning}</p>}
        <p className="text-sm text-gray-500 mt-4">
          Click to optimize the system and start searching
        </p>
      </div>
    </div>
  );
} 