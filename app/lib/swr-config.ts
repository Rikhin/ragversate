import { SWRConfiguration } from 'swr';

export const swrConfig: SWRConfiguration = {
  // Cache successful responses for 5 minutes
  dedupingInterval: 300000,
  
  // Revalidate on focus (when user returns to tab)
  revalidateOnFocus: true,
  
  // Revalidate on reconnect (when network comes back)
  revalidateOnReconnect: true,
  
  // Retry failed requests up to 3 times
  errorRetryCount: 3,
  
  // Exponential backoff for retries
  errorRetryInterval: 1000,
  
  // Keep cache data for 10 minutes even if component unmounts
  keepPreviousData: true,
  
  // Removed global fetcher to avoid serialization issues
  // Individual components should define their own fetchers
};

// Custom hooks for specific API endpoints
export const useSearchQuery = (query: string, userId?: string) => {
  const key = query ? `/api/get-answer` : null;
  return {
    key,
    options: {
      method: 'POST',
      body: JSON.stringify({ query, userId }),
    },
  };
};

export const useQuerySuggestions = (userId?: string) => {
  const key = userId ? `/api/query-suggestions?userId=${userId}` : null;
  return { key };
}; 