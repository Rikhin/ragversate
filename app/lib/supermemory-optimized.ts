import Supermemory from 'supermemory';
import { helixDB } from './helixdb';

// Optimized Supermemory service following best practices
export interface OptimizedMemory {
  id: string;
  userId: string;
  content: string;
  metadata: {
    type: 'conversation' | 'entity' | 'preference' | 'insight';
    timestamp: number;
    importance: number; // 0-1 scale
    tags: string[];
  };
}

export interface ConversationContext {
  userId: string;
  currentTopics: string[];
  recentEntities: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  complexity: 'simple' | 'moderate' | 'complex';
  sessionStart: number;
  messageCount: number;
}

class OptimizedSupermemoryService {
  private client!: Supermemory;
  private isInitialized: boolean = false;
  
  // Rate limiting and cost optimization
  private requestCount: number = 0;
  private lastReset: number = Date.now();
  private readonly RATE_LIMIT_PER_MINUTE = 5; // Very conservative limit due to rate limiting
  private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute
  
  // Local caching for cost efficiency
  private userContextCache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 300000; // 5 minutes
  
  // Batch processing for efficiency
  private memoryBatch: Array<{ content: string; metadata: any; tags: string[] }> = [];
  private readonly BATCH_SIZE = 5;
  private batchTimer: NodeJS.Timeout | null = null;

  constructor() {
    // Initialize batch processing
    this.startBatchProcessing();
  }

  private getApiKey(): string {
    const apiKey = process.env.SUPERMEMORY_API_KEY;
    if (!apiKey) {
      throw new Error('SUPERMEMORY_API_KEY environment variable is required');
    }
    return apiKey;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      this.client = new Supermemory({ apiKey: this.getApiKey() });
      
      // Minimal connection test
      try {
        await this.client.search.execute({ q: 'test', limit: 1 });
        console.log('✅ Optimized Supermemory service initialized successfully');
      } catch (error: unknown) {
        const apiError = error as { status?: number; error?: { error?: string } };
        if (apiError.status === 402 || apiError.status === 401) {
          console.log('✅ Optimized Supermemory service initialized (quota limits apply)');
        } else {
          console.log('✅ Optimized Supermemory service initialized');
        }
      }
      
      this.isInitialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize Optimized Supermemory service:', error);
      throw error;
    }
  }

  // Rate limiting check
  private checkRateLimit(): boolean {
    const now = Date.now();
    
    // Reset counter if window has passed
    if (now - this.lastReset > this.RATE_LIMIT_WINDOW) {
      this.requestCount = 0;
      this.lastReset = now;
    }
    
    if (this.requestCount >= this.RATE_LIMIT_PER_MINUTE) {
      console.warn('⚠️ Supermemory rate limit reached, using cached data');
      return false;
    }
    
    this.requestCount++;
    return true;
  }

  // Batch processing for cost efficiency
  private startBatchProcessing(): void {
    this.batchTimer = setInterval(async () => {
      if (this.memoryBatch.length > 0) {
        await this.processBatch();
      }
    }, 10000); // Process every 10 seconds
  }

  private async processBatch(): Promise<void> {
    if (!this.checkRateLimit()) return;
    
    const batch = this.memoryBatch.splice(0, this.BATCH_SIZE);
    
    try {
      const promises = batch.map(memory => 
        this.client.memories.add({
          content: memory.content,
          metadata: memory.metadata,
          containerTags: memory.tags
        })
      );
      
      await Promise.allSettled(promises);
      console.log(`💾 Batch processed ${batch.length} memories`);
    } catch (error) {
      console.error('❌ Batch processing failed:', error);
      // Return items to batch for retry
      this.memoryBatch.unshift(...batch);
    }
  }

  // Store memory with batching
  async storeMemory(
    userId: string,
    content: string,
    type: 'conversation' | 'entity' | 'preference' | 'insight',
    importance: number = 0.5,
    tags: string[] = []
  ): Promise<void> {
    await this.initialize();
    
    const memory = {
      content,
      metadata: {
        type,
        timestamp: Date.now(),
        importance,
        userId
      },
      tags: [userId, type, ...tags]
    };
    
    // Add to batch for efficient processing
    this.memoryBatch.push(memory);
    
    // Process immediately if batch is full
    if (this.memoryBatch.length >= this.BATCH_SIZE) {
      await this.processBatch();
    }
  }

  // Get user context with caching
  async getUserContext(userId: string): Promise<ConversationContext> {
    // Ensure client is initialized
    await this.initialize();
    
    // Check cache first
    const cached = this.userContextCache.get(userId);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      return cached.data;
    }
    
    if (!this.checkRateLimit()) {
      // Return default context if rate limited
      return {
        userId,
        currentTopics: [],
        recentEntities: [],
        sentiment: 'neutral',
        complexity: 'moderate',
        sessionStart: Date.now(),
        messageCount: 0
      };
    }
    
    try {
      const searchResult = await this.client.search.execute({
        q: 'user context preferences interests',
        containerTags: [userId],
        limit: 10
      });
      
      const context = this.buildContextFromMemories(searchResult.results, userId);
      
      // Cache the result
      this.userContextCache.set(userId, {
        data: context,
        timestamp: Date.now()
      });
      
      return context;
    } catch (error) {
      console.error('Failed to get user context:', error);
      
      // Check if it's a rate limit error
      if (error && typeof error === 'object' && 'status' in error) {
        const apiError = error as { status?: number; error?: { error?: string } };
        if (apiError.status === 401 || apiError.status === 402) {
          console.log('⚠️ Supermemory rate limited or unauthorized, using default context');
        }
      }
      
      return {
        userId,
        currentTopics: [],
        recentEntities: [],
        sentiment: 'neutral',
        complexity: 'moderate',
        sessionStart: Date.now(),
        messageCount: 0
      };
    }
  }

  // Search user knowledge efficiently
  async searchUserKnowledge(userId: string, query: string, limit: number = 3): Promise<any[]> {
    // Ensure client is initialized
    await this.initialize();
    
    if (!this.checkRateLimit()) {
      return [];
    }
    
    try {
      const searchResult = await this.client.search.execute({
        q: query,
        containerTags: [userId],
        limit
      });
      
      return searchResult.results.map(result => ({
        content: (result as any).text || (result as any).content || JSON.stringify(result),
        score: (result as any).score || 0,
        metadata: (result as any).metadata || {}
      }));
    } catch (error) {
      console.error('Failed to search user knowledge:', error);
      return [];
    }
  }

  // Generate follow-up questions efficiently
  async generateFollowUpQuestions(userId: string, query: string, response: string): Promise<string[]> {
    // Use local processing instead of API calls for cost efficiency
    const followUps: string[] = [];
    
    // Extract topics from query and response
    const topics = this.extractTopics(query);
    const responseTopics = this.extractTopics(response);
    
    // Generate contextual follow-ups
    if (topics.length > 0) {
      const mainTopic = topics[0];
      
      if (query.toLowerCase().includes('who is')) {
        followUps.push(`What are ${mainTopic}'s latest achievements?`);
        followUps.push(`How does ${mainTopic} compare to others in their field?`);
      } else if (query.toLowerCase().includes('what is')) {
        followUps.push(`How is ${mainTopic} used in practice?`);
        followUps.push(`What are the latest developments in ${mainTopic}?`);
      } else {
        followUps.push(`Tell me more about ${mainTopic}`);
        followUps.push(`What are the key aspects of ${mainTopic}?`);
      }
    }
    
    // Add response-based follow-ups
    if (responseTopics.length > 0) {
      const responseTopic = responseTopics[0];
      if (responseTopic !== topics[0]) {
        followUps.push(`How does ${responseTopic} relate to your question?`);
      }
    }
    
    // Store this interaction for learning
    await this.storeMemory(
      userId,
      JSON.stringify({ query, response, followUps }),
      'conversation',
      0.7,
      ['follow_up_generation']
    );
    
    return followUps.slice(0, 3);
  }

  // Get personalized suggestions efficiently
  async getPersonalizedSuggestions(userId: string, query: string): Promise<string[]> {
    const suggestions: string[] = [];
    
    // Get user context (cached)
    const context = await this.getUserContext(userId);
    
    // Generate suggestions based on context
    if (context.currentTopics.length > 0) {
      const recentTopic = context.currentTopics[0];
      suggestions.push(`Explore more about ${recentTopic}`);
    }
    
    // Add general suggestions based on query type
    if (query.toLowerCase().includes('technology')) {
      suggestions.push('Learn about emerging tech trends');
      suggestions.push('Explore AI and machine learning');
    } else if (query.toLowerCase().includes('business')) {
      suggestions.push('Discover startup strategies');
      suggestions.push('Learn about market analysis');
    } else {
      suggestions.push('Explore trending topics');
      suggestions.push('Discover new areas of interest');
    }
    
    return suggestions.slice(0, 3);
  }

  // Store conversation efficiently
  async storeConversation(
    userId: string,
    query: string,
    response: string,
    entities: Array<{ name: string; category: string; description: string }> = []
  ): Promise<void> {
    const importance = this.calculateImportance(query, response, entities);
    
    await this.storeMemory(
      userId,
      JSON.stringify({
        query,
        response,
        entities,
        timestamp: Date.now()
      }),
      'conversation',
      importance,
      ['conversation', 'user_interaction']
    );
    
    // Store entities separately for better searchability
    for (const entity of entities.slice(0, 2)) {
      await this.storeMemory(
        userId,
        JSON.stringify(entity),
        'entity',
        importance * 0.8,
        ['entity', entity.category]
      );
    }
  }

  // Helper methods
  private buildContextFromMemories(memories: any[], userId: string): ConversationContext {
    const topics = new Set<string>();
    const entities = new Set<string>();
    let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
    let complexity: 'simple' | 'moderate' | 'complex' = 'moderate';
    
    for (const memory of memories) {
      try {
        const data = JSON.parse(memory.content);
        
        if (data.query) {
          const queryTopics = this.extractTopics(data.query);
          queryTopics.forEach(topic => topics.add(topic));
        }
        
        if (data.entities) {
          data.entities.forEach((entity: any) => entities.add(entity.name));
        }
        
        // Analyze sentiment and complexity
        if (data.response) {
          sentiment = this.analyzeSentiment(data.response);
          complexity = this.analyzeComplexity(data.response);
        }
      } catch (error) {
        // Skip invalid JSON
      }
    }
    
    return {
      userId,
      currentTopics: Array.from(topics).slice(0, 5),
      recentEntities: Array.from(entities).slice(0, 5),
      sentiment,
      complexity,
      sessionStart: Date.now(),
      messageCount: memories.length
    };
  }

  private extractTopics(text: string): string[] {
    const words = text.toLowerCase().split(/\s+/);
    return words.filter(word => 
      word.length > 3 && 
      !['the', 'and', 'for', 'with', 'from', 'this', 'that', 'what', 'when', 'where', 'why', 'how'].includes(word)
    ).slice(0, 3);
  }

  private analyzeSentiment(text: string): 'positive' | 'neutral' | 'negative' {
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'successful'];
    const negativeWords = ['bad', 'terrible', 'awful', 'disappointing', 'frustrating', 'failed'];
    
    const textLower = text.toLowerCase();
    const positiveCount = positiveWords.filter(word => textLower.includes(word)).length;
    const negativeCount = negativeWords.filter(word => textLower.includes(word)).length;
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  private analyzeComplexity(text: string): 'simple' | 'moderate' | 'complex' {
    const wordCount = text.split(/\s+/).length;
    const hasComplexWords = /(algorithm|technology|philosophy|sophisticated|comprehensive|methodology)/i.test(text);
    
    if (wordCount < 20) return 'simple';
    if (wordCount > 100 || hasComplexWords) return 'complex';
    return 'moderate';
  }

  private calculateImportance(query: string, response: string, entities: any[]): number {
    let importance = 0.5; // Base importance
    
    // Increase importance for longer, more detailed responses
    if (response.length > 200) importance += 0.2;
    if (response.length > 500) importance += 0.1;
    
    // Increase importance for entity-rich responses
    if (entities.length > 0) importance += 0.1;
    if (entities.length > 2) importance += 0.1;
    
    // Increase importance for specific query types
    if (query.toLowerCase().includes('who is') || query.toLowerCase().includes('what is')) {
      importance += 0.1;
    }
    
    return Math.min(importance, 1.0);
  }

  // Cleanup method
  destroy(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }
  }
}

// Export singleton instance
export const optimizedSupermemoryService = new OptimizedSupermemoryService(); 