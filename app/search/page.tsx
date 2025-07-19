'use client';

import { useState } from 'react';
import AutoComplete from '../components/AutoComplete';
import SearchResults from '../components/SearchResults';

export default function SearchPage() {
  const [currentQuery, setCurrentQuery] = useState('');
  const [userId] = useState('user-' + Math.random().toString(36).substr(2, 9));

  const handleSearch = (query: string) => {
    setCurrentQuery(query);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              RAGversate Search
            </h1>
            <p className="text-lg text-gray-600">
              Search for entities, people, organizations, and concepts
            </p>
          </div>

          {/* Search Interface */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <AutoComplete
              onSelect={handleSearch}
              placeholder="Search for entities, people, organizations..."
              className="mb-4"
            />
            
            <div className="text-sm text-gray-500 text-center">
              💡 Try searching for researchers, companies, or concepts
            </div>
          </div>

          {/* Results */}
          {currentQuery && (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Results for: &quot;{currentQuery}&quot;
              </h2>
              <SearchResults query={currentQuery} userId={userId} />
            </div>
          )}

          {/* Quick Stats */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">846+</div>
              <div className="text-gray-600">Entities in Cache</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <div className="text-2xl font-bold text-green-600">16</div>
              <div className="text-gray-600">States Covered</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">Instant</div>
              <div className="text-gray-600">Cache Responses</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 