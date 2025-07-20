import Exa from 'exa-js';
import { helixDB } from './helixdb';
import OpenAI from 'openai';

// Fast web search service optimized for agentic behavior
export interface FastSearchResult {
  summary: string;
  entities: Array<{
    name: string;
    description: string;
    category: string;
    source: string;
    url?: string;
  }>;
  followUpQuestions: string[];
  confidence: 'high' | 'medium' | 'low';
  source: 'web';
  total: number;
}

export interface SearchOptions {
  numResults?: number;
  searchType?: 'neural' | 'keyword';
  useAutoprompt?: boolean;
  includeDomains?: string[];
  maxSummaryLength?: number;
  enableEntityCaching?: boolean;
  enableParallelProcessing?: boolean;
}

class FastWebSearchService {
  private searchCache = new Map<string, { data: FastSearchResult; timestamp: number }>();
  private readonly CACHE_TTL = 300000; // 5 minutes
  private readonly MAX_PARALLEL_REQUESTS = 3;
  private exa: Exa;
  private openai: OpenAI;

  constructor() {
    // Initialize clients
    this.exa = new Exa(process.env.EXA_API_KEY || process.env.EXASEARCH_API_KEY!);
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    // Clean up old cache entries periodically
    setInterval(() => this.cleanupCache(), 600000); // Every 10 minutes
  }

  async search(query: string, options: SearchOptions = {}): Promise<FastSearchResult> {
    // Smart query analysis to determine search depth and strategy
    const queryType = this.analyzeQueryType(query);
    
    const {
      numResults = queryType === 'specific' ? 8 : 5, // More results for specific queries
      searchType = queryType === 'specific' ? 'keyword' : 'neural', // Keyword for specific, neural for general
      useAutoprompt = queryType !== 'specific', // No autoprompt for specific queries
      includeDomains,
      maxSummaryLength = queryType === 'specific' ? 500 : 300, // Longer summaries for specific queries
      enableEntityCaching = true,
      enableParallelProcessing = true
    } = options;

    // Check cache first
    const cacheKey = this.generateCacheKey(query, options);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      console.log('🚀 Fast cache hit for web search');
      return cached;
    }

    console.log(`⚡ Fast web searching for: "${query}" (${numResults} results, ${searchType})`);

    const startTime = Date.now();

    try {
      // Step 1: Optimize query for better results
      const optimizedQuery = this.optimizeQuery(query);

      // Step 2: Execute search with optimized parameters
      const searchOptions = {
        numResults: queryType === 'specific' ? 8 : Math.min(numResults, 3), // More results for specific queries
        type: searchType as "neural" | "keyword",
        useAutoprompt: useAutoprompt,
        ...(includeDomains && { includeDomains })
      };

      const searchResponse = await this.exa.search(optimizedQuery, searchOptions);
      const results = searchResponse.results || [];

      if (results.length === 0) {
        return this.createEmptyResult(query);
      }

      // Step 3: Parallel processing for content extraction and entity caching
      const processingTasks = [];

      // Task 1: Extract content for summary generation
      const contentTask = this.extractContent(results.map(r => r.id), queryType === 'specific' ? 1200 : 600); // More content for specific queries
      processingTasks.push(contentTask);

      // Task 2: Entity caching (if enabled)
      if (enableEntityCaching) {
        const entityTask = this.cacheEntities(results, query);
        processingTasks.push(entityTask);
      }

      // Task 3: Generate follow-up questions
      const followUpTask = this.generateFollowUpQuestions(query, results);
      processingTasks.push(followUpTask);

      // Execute tasks in parallel
      const [contentResponse, entityResults, followUpQuestions] = await Promise.allSettled(processingTasks);

      // Step 4: Generate summary using extracted content
      const summary = await this.generateSummary(
        query,
        contentResponse.status === 'fulfilled' ? contentResponse.value : [],
        maxSummaryLength,
        queryType
      );

      // Step 5: Extract entities from results
      const entities = this.extractEntitiesFromResults(results, entityResults);

      // Step 6: Create final result
      const result: FastSearchResult = {
        summary,
        entities,
        followUpQuestions: followUpQuestions.status === 'fulfilled' && Array.isArray(followUpQuestions.value) 
          ? followUpQuestions.value as string[] 
          : [],
        confidence: this.calculateConfidence(results),
        source: 'web',
        total: results.length
      };

      // Cache the result
      this.setCache(cacheKey, result);

      const duration = Date.now() - startTime;
      console.log(`⚡ Fast web search completed in ${duration}ms`);

      return result;

    } catch (error) {
      console.error('Fast web search failed:', error);
      return this.createEmptyResult(query);
    }
  }

  private analyzeQueryType(query: string): 'specific' | 'general' {
    const lowerQuery = query.toLowerCase();
    
    // Specific query patterns that need detailed results
    const specificPatterns = [
      /summer programs? for/i,
      /camps? for/i,
      /programs? in [a-z]+/i,
      /universities? in [a-z]+/i,
      /colleges? in [a-z]+/i,
      /schools? in [a-z]+/i,
      /jobs? in [a-z]+/i,
      /events? in [a-z]+/i,
      /restaurants? in [a-z]+/i,
      /hotels? in [a-z]+/i,
      /prices? of/i,
      /cost of/i,
      /how much does/i,
      /where to find/i,
      /best [a-z]+ in [a-z]+/i,
      /top [a-z]+ in [a-z]+/i
    ];
    
    // Check if query matches specific patterns
    for (const pattern of specificPatterns) {
      if (pattern.test(lowerQuery)) {
        return 'specific';
      }
    }
    
    // General definition/concept queries
    const generalPatterns = [
      /what is/i,
      /who is/i,
      /tell me about/i,
      /explain/i,
      /define/i,
      /meaning of/i
    ];
    
    for (const pattern of generalPatterns) {
      if (pattern.test(lowerQuery)) {
        return 'general';
      }
    }
    
    // Default to specific for unknown patterns
    return 'specific';
  }

  private optimizeQuery(query: string): string {
    // Remove conversational elements for better search results
    let optimized = query
      .replace(/^(who is|what is|tell me about|who was|what are|how is|can you|please)/i, '')
      .replace(/\?/g, '')
      .trim();

    // Add context for better results
    if (optimized.length < 3) {
      optimized = query; // Keep original if too short
    }

    // Add quotes for exact name matching when appropriate
    const namePattern = /^[A-Z][a-z]+ [A-Z][a-z]+$/;
    if (namePattern.test(optimized)) {
      optimized = `"${optimized}"`;
    }

    // Add current year for time-sensitive queries
    if (optimized.toLowerCase().includes('latest') || optimized.toLowerCase().includes('recent')) {
      optimized += ` ${new Date().getFullYear()}`;
    }

    return optimized;
  }

  private async extractContent(resultIds: string[], maxChars: number = 800) {
    try {
      // Filter out empty or invalid result IDs
      const validResultIds = resultIds.filter(id => id && id.trim().length > 0);
      
      if (validResultIds.length === 0) {
        console.warn('No valid result IDs for content extraction');
        return [];
      }
      
      // Reduce content extraction for speed - only get first 3 results
      const limitedIds = validResultIds.slice(0, 3);
      
      const contentResponse = await this.exa.getContents(limitedIds, {
        text: { maxCharacters: maxChars }
      });
      return contentResponse.results || [];
    } catch (error) {
      console.warn('Content extraction failed:', error);
      return [];
    }
  }

  private async cacheEntities(results: Array<{ id: string; title: string; text: string; url: string }>[], query: string) {
    try {
      // Extract basic entities from search results without full content extraction
      const entities = results
        .filter(r => r.title && r.text)
        .map(r => ({
          name: r.title,
          description: r.text.substring(0, 200),
          category: this.categorizeEntity(r.title, r.text),
          source: 'web',
          url: r.url
        }))
        .slice(0, 3); // Limit to top 3 for speed

      // Store in HelixDB in background (don't wait)
      this.storeEntitiesInBackground(entities, query);

      return entities;
    } catch (error) {
      console.warn('Entity caching failed:', error);
      return [];
    }
  }

  private async storeEntitiesInBackground(entities: Array<{ name: string; category: string; source_query: string; description: string }>[], query: string) {
    // Store entities in background without blocking the response
    setImmediate(async () => {
      try {
        for (const entity of entities) {
          await helixDB.createEntity({
            name: entity.name,
            category: entity.category,
            source_query: entity.source_query,
            description: entity.description
          });
        }
        console.log(`💾 Background cached ${entities.length} entities`);
      } catch (error) {
        console.warn('Background entity storage failed:', error);
      }
    });
  }

  private async generateFollowUpQuestions(query: string, results: Array<{ id: string; title: string; text: string; url: string }>[]): Promise<string[]> {
    try {
      // Generate follow-up questions based on search results
      const titles = results.map(r => r.title).join(', ');
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo-0125',
        messages: [
          {
            role: 'system',
            content: 'Generate 2-3 natural follow-up questions based on the search results. Make them conversational and relevant.'
          },
          {
            role: 'user',
            content: `Query: "${query}"\nSearch results: ${titles}\n\nGenerate 2-3 follow-up questions:`
          }
        ],
        max_tokens: 100,
        temperature: 0.7
      });

      const questions = response.choices[0]?.message?.content?.split('\n').filter(q => q.trim()) || [];
      return questions.slice(0, 3);
    } catch (error) {
      console.warn('Follow-up generation failed:', error);
      return [];
    }
  }

  private async generateSummary(query: string, contents: Array<{ text: string }>[], maxLength: number, queryType: 'specific' | 'general' = 'general'): Promise<string> {
    try {
      if (contents.length === 0) {
        return `No detailed information found for "${query}".`;
      }

      // Use a faster approach for summary generation - limit content
      const textContent = contents
        .map(c => c.text?.substring(0, 300)) // Reduced from 500
        .filter(Boolean)
        .join('\n\n')
        .substring(0, 1000); // Reduced from 2000

      // Different prompts for different query types
      const systemPrompt = queryType === 'specific' 
        ? `Generate a detailed, specific summary (max ${maxLength} characters) for the query. For program queries, you MUST include specific program names, locations, dates, costs, and contact information when available. For location-based queries, provide concrete details and actionable information. Do NOT give generic responses - be specific and helpful. If you find program names, list them. If you find costs, mention them. If you find dates, include them.`
        : `Generate a concise summary (max ${maxLength} characters) for the query. Be brief but informative.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo-0125',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: `Query: "${query}"\n\nContent:\n${textContent}`
          }
        ],
        max_tokens: Math.ceil(maxLength / 3), // Reduced token count
        temperature: 0.2 // Lower temperature for faster generation
      });

      return response.choices[0]?.message?.content || `Information found for "${query}".`;
    } catch (error) {
      console.warn('Summary generation failed:', error);
      return `Information found for "${query}".`;
    }
  }

  private extractEntitiesFromResults(results: Array<{ id: string; title: string; text: string; url: string }>[], entityResults: unknown): Array<{ name: string; description: string; category: string; source: string; url?: string }> {
    if (entityResults && Array.isArray(entityResults) && entityResults.length > 0) {
      return entityResults as Array<{ name: string; description: string; category: string; source: string; url?: string }>;
    }

    // Fallback: extract basic entities from search results
    return results
      .slice(0, 3)
      .map(r => ({
        name: r.title,
        description: r.text?.substring(0, 150) || 'No description available',
        category: 'other',
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

  private calculateConfidence(results: Array<{ id: string; title: string; text: string; url: string }>): 'high' | 'medium' | 'low' {
    if (results.length >= 5) return 'high';
    if (results.length >= 3) return 'medium';
    return 'low';
  }

  private createEmptyResult(query: string): FastSearchResult {
    return {
      summary: `No information found for "${query}".`,
      entities: [],
      followUpQuestions: [],
      confidence: 'low',
      source: 'web',
      total: 0
    };
  }

  private generateCacheKey(query: string, options: SearchOptions): string {
    const key = `${query}_${JSON.stringify(options)}`;
    return Buffer.from(key).toString('base64').substring(0, 32);
  }

  private getFromCache(key: string): FastSearchResult | null {
    const cached = this.searchCache.get(key);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      return cached.data;
    }
    return null;
  }

  private setCache(key: string, data: FastSearchResult): void {
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

  // Get cache statistics
  getCacheStats() {
    return {
      size: this.searchCache.size,
      keys: Array.from(this.searchCache.keys())
    };
  }

  // Clear cache
  clearCache(): void {
    this.searchCache.clear();
  }
}

// Export singleton instance
export const fastWebSearch = new FastWebSearchService(); 