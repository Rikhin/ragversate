import Exa from 'exa-js';
import { helixDB } from './helixdb';
import OpenAI from 'openai';

// Ultra-fast web search service - prioritizes speed over completeness
export interface UltraFastSearchResult {
  summary: string;
  entities: Array<{
    name: string;
    description: string;
    category: string;
    source: string;
    url?: string;
  }>;
  confidence: 'high' | 'medium' | 'low';
  source: 'web';
  total: number;
}

export interface UltraFastSearchOptions {
  numResults?: number;
  searchType?: 'neural' | 'keyword';
  useAutoprompt?: boolean;
  maxSummaryLength?: number;
  enableCaching?: boolean;
  skipContentExtraction?: boolean;
  skipFollowUpQuestions?: boolean;
}

class UltraFastWebSearchService {
  private searchCache = new Map<string, { data: UltraFastSearchResult; timestamp: number }>();
  private readonly CACHE_TTL = 600000; // 10 minutes (longer cache)
  private exa: Exa;
  private openai: OpenAI;

  constructor() {
    this.exa = new Exa(process.env.EXA_API_KEY || process.env.EXASEARCH_API_KEY!);
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    // Clean up old cache entries periodically
    setInterval(() => this.cleanupCache(), 1200000); // Every 20 minutes
  }

  async search(query: string, options: UltraFastSearchOptions = {}): Promise<UltraFastSearchResult> {
    const {
      numResults = 2, // Reduced from 3 to 2
      searchType = 'keyword', // Use keyword instead of neural for speed
      useAutoprompt = false, // Disable autoprompt for speed
      maxSummaryLength = 200, // Shorter summaries
      enableCaching = true,
      skipContentExtraction = true, // Skip expensive content extraction
      skipFollowUpQuestions = true // Skip follow-up questions
    } = options;

    // Check cache first
    if (enableCaching) {
      const cacheKey = this.generateCacheKey(query, options);
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        console.log('🚀 Ultra-fast cache hit for web search');
        return cached;
      }
    }

    console.log(`⚡ Ultra-fast web searching for: "${query}" (${numResults} results, ${searchType})`);

    const startTime = Date.now();

    try {
      // Step 1: Optimize query for speed
      const optimizedQuery = this.optimizeQueryForSpeed(query);

      // Step 2: Execute fast search with minimal parameters
      const searchOptions = {
        numResults: Math.min(numResults, 2), // Max 2 results
        type: searchType as "neural" | "keyword",
        useAutoprompt: useAutoprompt,
        // Skip expensive features
        highlights: false,
        includeDomains: undefined
      };

      const searchResponse = await this.exa.search(optimizedQuery, searchOptions);
      const results = searchResponse.results || [];

      if (results.length === 0) {
        return this.createEmptyResult(query);
      }

      // Step 3: Generate ultra-fast summary from titles and snippets only
      const summary = await this.generateUltraFastSummary(query, results, maxSummaryLength);

      // Step 4: Extract basic entities from search results (no content extraction)
      const entities = this.extractBasicEntities(results);

      // Step 5: Create final result
      const result: UltraFastSearchResult = {
        summary,
        entities,
        confidence: this.calculateConfidence(results),
        source: 'web',
        total: results.length
      };

      // Cache the result
      if (enableCaching) {
        const cacheKey = this.generateCacheKey(query, options);
        this.setCache(cacheKey, result);
      }

      // Background caching (don't wait)
      this.backgroundCache(query, results);

      const duration = Date.now() - startTime;
      console.log(`⚡ Ultra-fast web search completed in ${duration}ms`);

      return result;

    } catch (error) {
      console.error('Ultra-fast web search failed:', error);
      return this.createEmptyResult(query);
    }
  }

  private optimizeQueryForSpeed(query: string): string {
    // Ultra-fast query optimization
    let optimized = query
      .replace(/^(who is|what is|tell me about|who was|what are|how is|can you|please|explain|describe)/i, '')
      .replace(/\?/g, '')
      .trim();

    // Keep original if too short
    if (optimized.length < 3) {
      optimized = query;
    }

    // Add quotes for exact name matching
    const namePattern = /^[A-Z][a-z]+ [A-Z][a-z]+$/;
    if (namePattern.test(optimized)) {
      optimized = `"${optimized}"`;
    }

    return optimized;
  }

  private async generateUltraFastSummary(query: string, results: Exa.SearchResult[], maxLength: number): Promise<string> {
    try {
      // Use only titles and snippets for ultra-fast summary
      const titles = results.map(r => r.title).join(', ');
      const snippets = results.map(r => r.text?.substring(0, 100)).filter(Boolean).join(' ');

      // If we have enough info from snippets, use them directly
      if (snippets.length > 50) {
        return this.createSummaryFromSnippets(query, snippets, maxLength);
      }

      // Otherwise, use GPT for minimal processing
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo-0125', // Faster model
        messages: [
          {
            role: 'system',
            content: `Generate a very brief summary (max ${maxLength} characters) for the query. Be concise.`
          },
          {
            role: 'user',
            content: `Query: "${query}"\nTitles: ${titles}\nSnippets: ${snippets}`
          }
        ],
        max_tokens: Math.ceil(maxLength / 3),
        temperature: 0.1 // Very low temperature for speed
      });

      return response.choices[0]?.message?.content || `Information found for "${query}".`;
    } catch (error) {
      console.warn('Ultra-fast summary generation failed:', error);
      return `Information found for "${query}".`;
    }
  }

  private createSummaryFromSnippets(query: string, snippets: string, maxLength: number): string {
    // Create summary directly from snippets without GPT
    const words = snippets.split(' ').slice(0, 20); // Take first 20 words
    const summary = words.join(' ');
    
    if (summary.length <= maxLength) {
      return summary;
    }
    
    return summary.substring(0, maxLength - 3) + '...';
  }

  private extractBasicEntities(results: Exa.SearchResult[]): Array<{
    name: string;
    description: string;
    category: string;
    source: string;
    url?: string;
  }> {
    return results
      .slice(0, 2) // Only top 2
      .map(r => ({
        name: r.title,
        description: r.text?.substring(0, 100) || 'No description available',
        category: this.categorizeEntity(r.title, r.text || ''),
        source: 'web',
        url: r.url
      }));
  }

  private categorizeEntity(title: string, text: string): string {
    const lowerTitle = title.toLowerCase();
    const lowerText = text.toLowerCase();

    if (lowerTitle.includes('ceo') || lowerTitle.includes('founder') || lowerTitle.includes('president')) {
      return 'person';
    }
    if (lowerTitle.includes('inc') || lowerTitle.includes('corp') || lowerTitle.includes('company')) {
      return 'organization';
    }
    if (lowerTitle.includes('city') || lowerTitle.includes('country') || lowerTitle.includes('state')) {
      return 'place';
    }
    if (lowerText.includes('technology') || lowerText.includes('method') || lowerText.includes('concept')) {
      return 'concept';
    }
    return 'other';
  }

  private calculateConfidence(results: Exa.SearchResult[]): 'high' | 'medium' | 'low' {
    if (results.length >= 2) return 'high';
    if (results.length >= 1) return 'medium';
    return 'low';
  }

  private createEmptyResult(query: string): UltraFastSearchResult {
    return {
      summary: `No information found for "${query}".`,
      entities: [],
      confidence: 'low',
      source: 'web',
      total: 0
    };
  }

  private backgroundCache(query: string, results: Exa.SearchResult[]): void {
    // Cache entities in background without blocking
    setImmediate(async () => {
      try {
        for (const result of results.slice(0, 2)) {
          await helixDB.createEntityWithDeduplication({
            name: result.title,
            category: this.categorizeEntity(result.title, result.text || ''),
            source_query: query,
            description: result.text?.substring(0, 200) || 'No description'
          });
        }
        console.log(`💾 Background cached ${results.length} entities`);
      } catch (error) {
        console.warn('Background caching failed:', error);
      }
    });
  }

  private generateCacheKey(query: string, options: UltraFastSearchOptions): string {
    const key = `${query}_${JSON.stringify(options)}`;
    return Buffer.from(key).toString('base64').substring(0, 32);
  }

  private getFromCache(key: string): UltraFastSearchResult | null {
    const cached = this.searchCache.get(key);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      return cached.data;
    }
    return null;
  }

  private setCache(key: string, data: UltraFastSearchResult): void {
    this.searchCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, value] of this.searchCache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.searchCache.delete(key);
      }
    }
  }

  getCacheStats() {
    return {
      size: this.searchCache.size,
      keys: Array.from(this.searchCache.keys())
    };
  }

  clearCache(): void {
    this.searchCache.clear();
  }
}

// Export singleton instance
export const ultraFastWebSearch = new UltraFastWebSearchService(); 