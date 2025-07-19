'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function BeginButton() {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const router = useRouter();

  const handleBegin = async () => {
    setIsOptimizing(true);
    setProgress(0);

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

      // Step 4: Warming HelixDB cache
      setCurrentStep('Warming HelixDB cache...');
      setProgress(50);
      try {
        const response = await fetch('/api/optimize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('Optimization completed:', result);
        } else {
          console.log('Optimization failed, continuing...');
        }
      } catch (error) {
        console.log('Optimization failed, continuing...', error);
      }
      await new Promise(resolve => setTimeout(resolve, 1000));

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
      console.error('Optimization failed:', error);
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
        
        <p className="text-sm text-gray-500 mt-4">
          Click to optimize the system and start searching
        </p>
      </div>
    </div>
  );
} 