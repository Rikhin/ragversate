'use client';

import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';

interface AutoCompleteProps {
  onSelect?: (suggestion: string) => void;
  onSearch?: (query: string) => void;
  placeholder?: string;
  className?: string;
}

interface SuggestionResponse {
  suggestions: string[];
  query: string;
  total: number;
}

export default function AutoComplete({ 
  onSelect, 
  onSearch, 
  placeholder = "Search entities...", 
  className = "" 
}: AutoCompleteProps) {
  const [query, setQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Fetch suggestions using SWR
  const { data, error } = useSWR<SuggestionResponse>(
    query.length >= 2 ? `/api/suggestions?q=${encodeURIComponent(query)}&limit=5` : null,
    async (url) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch suggestions');
      return response.json();
    },
    {
      dedupingInterval: 1000, // 1 second
      revalidateOnFocus: false,
    }
  );

  const suggestions = data?.suggestions || [];

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showSuggestions || suggestions.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < suggestions.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
            handleSelect(suggestions[selectedIndex]);
          } else if (query.trim()) {
            handleSearch(query.trim());
          }
          break;
        case 'Escape':
          setShowSuggestions(false);
          setSelectedIndex(-1);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showSuggestions, suggestions, selectedIndex, query]);

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(event.target as Node) &&
          suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setShowSuggestions(value.length >= 2);
    setSelectedIndex(-1);
  };

  const handleSelect = (suggestion: string) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    if (onSelect) {
      onSelect(suggestion);
    } else if (onSearch) {
      onSearch(suggestion);
    }
  };

  const handleSearch = (searchQuery: string) => {
    setShowSuggestions(false);
    setSelectedIndex(-1);
    if (onSearch) {
      onSearch(searchQuery);
    }
  };

  const handleFocus = () => {
    if (query.length >= 2) {
      setShowSuggestions(true);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder={placeholder}
          className="w-full px-6 py-4 pr-12 border border-gray-200 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg shadow-sm"
        />
        
        {/* Search Button */}
        <button
          onClick={() => query.trim() && handleSearch(query.trim())}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 w-8 h-8 bg-blue-500 hover:bg-blue-600 text-white rounded-full flex items-center justify-center transition-colors"
          disabled={!query.trim()}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
      </div>
      
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {suggestions.map((suggestion, index) => (
            <div
              key={index}
              className={`px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                index === selectedIndex ? 'bg-blue-50 text-blue-700' : ''
              }`}
              onClick={() => handleSelect(suggestion)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="flex items-center">
                <span className="text-gray-400 mr-3">🔍</span>
                <span>{suggestion}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {showSuggestions && error && (
        <div className="absolute z-10 w-full mt-2 bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm">
          Failed to load suggestions
        </div>
      )}
      
      {showSuggestions && query.length >= 2 && suggestions.length === 0 && !error && (
        <div className="absolute z-10 w-full mt-2 bg-gray-50 border border-gray-200 rounded-lg p-3 text-gray-500 text-sm">
          No suggestions found
        </div>
      )}
    </div>
  );
} 