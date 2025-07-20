'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function BeginButton() {
  // Temporarily remove the Begin button and related UI
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white">
      <div className="text-center max-w-md mx-4">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Welcome to RAGversate
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          The system is being set up. Please check back after all HelixDB instances are running and data is loaded.
        </p>
        <p className="text-sm text-gray-500 mt-4">
          Optimization and search will be available soon.
        </p>
      </div>
    </div>
  );
} 