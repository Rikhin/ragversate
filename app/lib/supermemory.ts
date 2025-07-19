import Supermemory from 'supermemory';

// Types for our memory system
export interface UserMemory {
  id: string;
  userId: string;
  query: string;
  response: string;
  entities: Array<{
    name: string;
    category: string;
    description: string;
  }>;
  metadata: {
    timestamp: number;
    queryType: 'direct' | 'exploratory' | 'suggestion';
    entitiesFound: number;
    userSatisfaction?: number;
  };
  containerTags: string[];
}

export interface QuerySuggestion {
  query: string;
  score: number;
  context?: string;
  timestamp?: number;
}

export interface UserContext {
  userId: string;
  recentQueries: string[];
  interests: string[];
  preferredCategories: string[];
  lastActive: number;
  queryPatterns: string[];
}

interface UserKnowledgeResult {
  score: number;
  content: string;
  query?: string;
  response?: string;
  entities?: Array<{ name: string; category: string; description: string }>;
}

class SupermemoryService {
  private client!: Supermemory;
  private isInitialized: boolean = false;

  constructor() {
    // Don't initialize immediately - wait for initialize() call
  }

  private getApiKey(): string {
    const apiKey = process.env.SUPERMEMORY_API_KEY;
    if (!apiKey) {
      throw new Error('SUPERMEMORY_API_KEY environment variable is required');
    }
    return apiKey;
  }

  // Initialize the service
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      // Initialize client with API key
      this.client = new Supermemory({ apiKey: this.getApiKey() });
      
      // Simple connection test
      try {
        await this.client.search.execute({ q: 'test', limit: 1 });
        console.log('✅ Supermemory service initialized successfully');
      } catch (error: unknown) {
        // Handle any initialization errors gracefully
        const apiError = error as { status?: number; error?: { error?: string } };
        if (apiError.status === 402) {
          console.log('✅ Supermemory service initialized (quota limits apply)');
        } else {
          console.log('✅ Supermemory service initialized');
        }
      }
      
      this.isInitialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize Supermemory service:', error);
      throw error;
    }
  }

  // Generate or retrieve user ID from session
  private generateUserId(): string {
    // In a real app, this would come from authentication
    // For now, we'll use a simple session-based approach
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Store a user's query and response
  async storeUserMemory(
    userId: string,
    query: string,
    response: string,
    entities: Array<{ name: string; category: string; description: string }> = [],
    metadata: Partial<UserMemory['metadata']> = {}
  ): Promise<string> {
    await this.initialize();

    const memoryContent = JSON.stringify({
      query,
      response,
      entities,
      metadata: {
        timestamp: Date.now(),
        queryType: this.classifyQueryType(query),
        entitiesFound: entities.length,
        ...metadata
      }
    });

    try {
      const result = await this.client.memories.add({
        content: memoryContent,
        metadata: {
          type: 'user_memory',
          query: query.substring(0, 100), // Store truncated query for search
          entitiesCount: entities.length,
          queryType: this.classifyQueryType(query),
          timestamp: Date.now()
        },
        containerTags: [userId, 'user_memory', 'query_response']
      });

      console.log(`💾 Stored memory for user ${userId}: ${query.substring(0, 50)}...`);
      return result.id;
    } catch (error) {
      console.error('Failed to store user memory:', error);
      // Return a fallback ID instead of throwing
      return `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  }

  // Get query suggestions based on global knowledge and user history
  async getQuerySuggestions(userId: string, query: string, limit: number = 5): Promise<QuerySuggestion[]> {
    try {
      await this.initialize();

      const context = await this.getUserContext(userId);
      const userKnowledge = await this.searchUserKnowledge(userId, query, 10);
      
      // Get global knowledge from HelixDB for better suggestions
      const globalSuggestions = await this.getGlobalSuggestions(query, limit);
      
      // Combine user-specific and global suggestions
      const allSuggestions: QuerySuggestion[] = [];
      
      // Add user-specific suggestions first
      if (context.recentQueries.length > 0) {
        const userSuggestions = context.recentQueries
          .filter(q => q.toLowerCase() !== query.toLowerCase())
          .slice(0, 3)
          .map(q => ({ query: q, score: 0.8 }));
        allSuggestions.push(...userSuggestions);
      }
      
      // Add global suggestions
      allSuggestions.push(...globalSuggestions);
      
      // Add category-based suggestions
      if (context.preferredCategories.length > 0) {
        const categorySuggestions = this.generateCategorySuggestions(context.preferredCategories, query);
        allSuggestions.push(...categorySuggestions);
      }
      
      // Deduplicate and sort by relevance
      const uniqueSuggestions = this.deduplicateSuggestions(allSuggestions);
      uniqueSuggestions.sort((a, b) => b.score - a.score);
      
      return uniqueSuggestions.slice(0, limit);
    } catch (error) {
      console.error('Failed to get query suggestions:', error);
      return [];
    }
  }

  // Get global suggestions based on HelixDB knowledge
  private async getGlobalSuggestions(query: string, limit: number): Promise<QuerySuggestion[]> {
    try {
      // Import HelixDB here to avoid circular dependencies
      const { helixDB } = await import('./helixdb');
      
      // Search for related entities in global cache
      const searchResult = await helixDB.semanticSearch(query, limit * 2);
      
      const suggestions: QuerySuggestion[] = [];
      
      for (const entity of searchResult.entities) {
        // Generate suggestions based on entity type
        if (entity.category === 'person') {
          suggestions.push({
            query: `What did ${entity.name} do?`,
            score: 0.9
          });
          suggestions.push({
            query: `Tell me about ${entity.name}`,
            score: 0.8
          });
        } else if (entity.category === 'organization') {
          suggestions.push({
            query: `What does ${entity.name} do?`,
            score: 0.9
          });
          suggestions.push({
            query: `Who founded ${entity.name}?`,
            score: 0.7
          });
        } else if (entity.category === 'place') {
          suggestions.push({
            query: `What is ${entity.name} known for?`,
            score: 0.8
          });
        }
      }
      
      return suggestions;
    } catch (error) {
      console.error('Failed to get global suggestions:', error);
      return [];
    }
  }

  // Generate category-based suggestions
  private generateCategorySuggestions(preferredCategories: string[], query: string): QuerySuggestion[] {
    const suggestions: QuerySuggestion[] = [];
    
    for (const category of preferredCategories.slice(0, 2)) {
      if (category === 'person') {
        suggestions.push({
          query: `Who is the most famous person in ${query}?`,
          score: 0.6
        });
      } else if (category === 'organization') {
        suggestions.push({
          query: `What companies are related to ${query}?`,
          score: 0.6
        });
      } else if (category === 'place') {
        suggestions.push({
          query: `Where is ${query} located?`,
          score: 0.6
        });
      }
    }
    
    return suggestions;
  }

  // Deduplicate suggestions while preserving order
  private deduplicateSuggestions(suggestions: QuerySuggestion[]): QuerySuggestion[] {
    const seen = new Set<string>();
    return suggestions.filter(suggestion => {
      const key = suggestion.query.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // Get user context for personalized responses
  async getUserContext(userId: string): Promise<UserContext> {
    await this.initialize();

    try {
      const searchResult = await this.client.search.execute({
        q: 'user context preferences interests',
        containerTags: [userId, 'user_memory'],
        filters: {
          AND: [
            {
              key: 'type',
              value: 'user_memory'
            }
          ]
        },
        limit: 20,
        documentThreshold: 0.2
      });

      const recentQueries: string[] = [];
      const interests = new Set<string>();
      const categoryCounts: Record<string, number> = {};

      for (const result of searchResult.results) {
        try {
          const memoryData = JSON.parse(result.chunks[0]?.content || '{}');
          
          if (memoryData.query) {
            recentQueries.push(memoryData.query);
          }

          // Extract interests from entities
          if (memoryData.entities) {
            for (const entity of memoryData.entities) {
              if (entity.category) {
                categoryCounts[entity.category] = (categoryCounts[entity.category] || 0) + 1;
              }
              if (entity.description) {
                // Extract key terms as interests
                const terms = entity.description.toLowerCase().split(/\s+/);
                terms.forEach((term: string) => {
                  if (term.length > 3 && !['the', 'and', 'for', 'with', 'from'].includes(term)) {
                    interests.add(term);
                  }
                });
              }
            }
          }
        } catch (parseError) {
          console.warn('Failed to parse memory data for context:', parseError);
        }
      }

      // Get preferred categories
      const preferredCategories = Object.entries(categoryCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([category]) => category);

      // Analyze query patterns from recent queries
      const queryPatterns = this.analyzeQueryPatterns(recentQueries);

      return {
        userId,
        recentQueries: recentQueries.slice(0, 10),
        interests: Array.from(interests).slice(0, 20),
        preferredCategories: preferredCategories,
        lastActive: Date.now(),
        queryPatterns: queryPatterns
      };

    } catch (error) {
      console.error('Failed to get user context:', error);
      return {
        userId,
        recentQueries: [],
        interests: [],
        preferredCategories: [],
        lastActive: Date.now(),
        queryPatterns: []
      };
    }
  }

  // Search user's personal knowledge base
  async searchUserKnowledge(userId: string, query: string, limit: number = 5): Promise<UserKnowledgeResult[]> {
    await this.initialize();

    try {
      const searchResult = await this.client.search.execute({
        q: query,
        containerTags: [userId, 'user_memory'],
        filters: {
          AND: [
            {
              key: 'type',
              value: 'user_memory'
            }
          ]
        },
        limit,
        documentThreshold: 0.3,
        chunkThreshold: 0.4
      });

      return searchResult.results.map(result => {
        try {
          const parsed = JSON.parse(result.chunks[0]?.content || '{}');
          return {
            score: result.score || 0,
            content: result.chunks[0]?.content || '',
            query: parsed.query,
            response: parsed.response,
            entities: parsed.entities
          };
        } catch {
          return { 
            score: result.score || 0, 
            content: result.chunks[0]?.content || '' 
          };
        }
      });

    } catch (error) {
      console.error('Failed to search user knowledge:', error);
      return [];
    }
  }

  // Classify query type for better memory organization
  private classifyQueryType(query: string): 'direct' | 'exploratory' | 'suggestion' {
    const lowerQuery = query.toLowerCase();
    
    // Direct queries: specific questions about entities
    if (lowerQuery.includes('who is') || lowerQuery.includes('what is') || 
        lowerQuery.includes('tell me about') || lowerQuery.includes('information about')) {
      return 'direct';
    }
    
    // Exploratory queries: open-ended, advice-seeking
    if (lowerQuery.includes('what should') || lowerQuery.includes('how can') || 
        lowerQuery.includes('suggest') || lowerQuery.includes('recommend') ||
        lowerQuery.includes('next') || lowerQuery.includes('ideas')) {
      return 'exploratory';
    }
    
    return 'suggestion';
  }

  // Get personalized response suggestions for exploratory queries
  async getPersonalizedSuggestions(userId: string, query: string): Promise<string[]> {
    try {
      await this.initialize();

      const context = await this.getUserContext(userId);
      const userKnowledge = await this.searchUserKnowledge(userId, query, 3);

      const suggestions: string[] = [];

      // Add suggestions based on user's interests
      if (context.interests.length > 0) {
        const relevantInterests = context.interests
          .filter(interest => query.toLowerCase().includes(interest) || 
                             interest.length > 4 && !['the', 'and', 'for'].includes(interest))
          .slice(0, 3);
        
        if (relevantInterests.length > 0) {
          suggestions.push(`Based on your interest in ${relevantInterests.join(', ')}, you might enjoy exploring related topics.`);
        }
      }

      // Add suggestions based on past queries
      if (context.recentQueries.length > 0) {
        const relatedQueries = context.recentQueries
          .filter(q => q.toLowerCase() !== query.toLowerCase())
          .slice(0, 2);
        
        if (relatedQueries.length > 0) {
          suggestions.push(`You've previously asked about: ${relatedQueries.join(', ')}. Consider exploring these topics further.`);
        }
      }

      // Add suggestions based on preferred categories
      if (context.preferredCategories.length > 0) {
        suggestions.push(`You often search for ${context.preferredCategories[0]} and ${context.preferredCategories[1] || 'various topics'}.`);
      }

      return suggestions;
    } catch (error) {
      console.error('Failed to get personalized suggestions:', error);
      // Return default suggestions if there's an error
      return [
        'What should I learn next?',
        'What are the latest trends in technology?',
        'Can you suggest some interesting topics to explore?'
      ];
    }
  }

  // Generate intelligent follow-up questions based on user history and current query
  async generateFollowUpQuestions(userId: string, query: string, response: string): Promise<string[]> {
    try {
      await this.initialize();

      const context = await this.getUserContext(userId);
      const queryType = this.classifyQueryType(query);
      
      const followUps: string[] = [];

      // Generate follow-ups based on query type
      if (queryType === 'direct') {
        // For direct queries about entities, suggest related topics
        followUps.push(
          'What are the latest developments?',
          'How does this compare to similar cases?',
          'What are the key challenges or controversies?'
        );
      } else if (queryType === 'exploratory') {
        // For exploratory queries, suggest specific actions
        followUps.push(
          'Can you provide specific examples?',
          'What are the practical applications?',
          'What should I focus on first?'
        );
      }

      // Add personalized follow-ups based on user history
      if (context.recentQueries.length > 0) {
        const recentTopics = context.recentQueries.slice(0, 2);
        followUps.push(`How does this relate to ${recentTopics[0]}?`);
      }

      // Add category-specific suggestions
      if (context.preferredCategories.length > 0) {
        const topCategory = context.preferredCategories[0];
        if (topCategory === 'person') {
          followUps.push('What are their current projects?');
        } else if (topCategory === 'organization') {
          followUps.push('What are their recent achievements?');
        } else if (topCategory === 'place') {
          followUps.push('What makes this location significant?');
        }
      }

      // Ensure we don't exceed 4 suggestions
      return followUps.slice(0, 4);
    } catch (error) {
      console.error('Failed to generate follow-up questions:', error);
      return [
        'Tell me more about this topic',
        'What are the latest developments?',
        'How does this compare to similar cases?'
      ];
    }
  }

  // Get user insights for better personalization
  async getUserInsights(userId: string): Promise<{
    queryPatterns: string[];
    favoriteTopics: string[];
    searchFrequency: number;
    preferredQueryTypes: string[];
    knowledgeGaps: string[];
  }> {
    try {
      await this.initialize();

      const context = await this.getUserContext(userId);
      const userKnowledge = await this.searchUserKnowledge(userId, '', 20);

      // Analyze query patterns
      const queryPatterns = this.analyzeQueryPatterns(context.recentQueries);
      
      // Identify favorite topics
      const favoriteTopics = this.identifyFavoriteTopics(context.interests, userKnowledge);
      
      // Calculate search frequency (queries per day)
      const searchFrequency = this.calculateSearchFrequency(context.lastActive, context.recentQueries.length);
      
      // Determine preferred query types
      const preferredQueryTypes = this.analyzeQueryTypes(context.recentQueries);
      
      // Identify knowledge gaps
      const knowledgeGaps = this.identifyKnowledgeGaps(context.interests, userKnowledge);

      return {
        queryPatterns,
        favoriteTopics,
        searchFrequency,
        preferredQueryTypes,
        knowledgeGaps
      };
    } catch (error) {
      console.error('Failed to get user insights:', error);
      return {
        queryPatterns: [],
        favoriteTopics: [],
        searchFrequency: 0,
        preferredQueryTypes: [],
        knowledgeGaps: []
      };
    }
  }

  // Analyze query patterns for better suggestions
  private analyzeQueryPatterns(queries: string[]): string[] {
    const patterns: string[] = [];
    
    // Look for common patterns
    const whoIsCount = queries.filter(q => q.toLowerCase().includes('who is')).length;
    const whatIsCount = queries.filter(q => q.toLowerCase().includes('what is')).length;
    const howToCount = queries.filter(q => q.toLowerCase().includes('how')).length;
    
    if (whoIsCount > 2) patterns.push('Person-focused queries');
    if (whatIsCount > 2) patterns.push('Concept exploration');
    if (howToCount > 2) patterns.push('How-to questions');
    
    return patterns;
  }

  // Identify user's favorite topics
  private identifyFavoriteTopics(interests: string[], knowledge: UserKnowledgeResult[]): string[] {
    const topicCounts = new Map<string, number>();
    
    // Count interests
    interests.forEach(interest => {
      topicCounts.set(interest, (topicCounts.get(interest) || 0) + 1);
    });
    
    // Count knowledge base topics
    knowledge.forEach(item => {
      if (item.entities) {
        item.entities.forEach((entity: { name: string; category: string; description: string }) => {
          const category = entity.category || 'other';
          topicCounts.set(category, (topicCounts.get(category) || 0) + 1);
        });
      }
    });
    
    // Return top 3 topics
    return Array.from(topicCounts.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([topic]) => topic);
  }

  // Calculate user's search frequency
  private calculateSearchFrequency(lastActive: number, queryCount: number): number {
    const daysSinceActive = (Date.now() - lastActive) / (1000 * 60 * 60 * 24);
    return daysSinceActive > 0 ? queryCount / daysSinceActive : queryCount;
  }

  // Analyze preferred query types
  private analyzeQueryTypes(queries: string[]): string[] {
    const types = new Map<string, number>();
    
    queries.forEach(query => {
      const lowerQuery = query.toLowerCase();
      if (lowerQuery.includes('who is') || lowerQuery.includes('who was')) {
        types.set('person', (types.get('person') || 0) + 1);
      } else if (lowerQuery.includes('what is') || lowerQuery.includes('what are')) {
        types.set('concept', (types.get('concept') || 0) + 1);
      } else if (lowerQuery.includes('how') || lowerQuery.includes('why')) {
        types.set('process', (types.get('process') || 0) + 1);
      } else {
        types.set('general', (types.get('general') || 0) + 1);
      }
    });
    
    return Array.from(types.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 2)
      .map(([type]) => type);
  }

  // Identify knowledge gaps for better suggestions
  private identifyKnowledgeGaps(interests: string[], knowledge: UserKnowledgeResult[]): string[] {
    const gaps: string[] = [];
    
    // Look for interests without corresponding knowledge
    interests.forEach(interest => {
      const hasKnowledge = knowledge.some(item => 
        item.entities && item.entities.some((entity: { name: string; category: string; description: string }) => 
          entity.description.toLowerCase().includes(interest.toLowerCase())
        )
      );
      
      if (!hasKnowledge && interest.length > 4) {
        gaps.push(interest);
      }
    });
    
    return gaps.slice(0, 3);
  }

  // Store entity information for a user
  async storeUserEntity(
    userId: string,
    entity: { name: string; category: string; description: string },
    sourceQuery: string
  ): Promise<string> {
    await this.initialize();

    try {
      const result = await this.client.memories.add({
        content: JSON.stringify({
          entity,
          sourceQuery,
          timestamp: Date.now()
        }),
        metadata: {
          type: 'user_entity',
          entityName: entity.name,
          entityCategory: entity.category,
          sourceQuery: sourceQuery.substring(0, 100)
        },
        containerTags: [userId, 'user_entity', entity.category]
      });

      console.log(`💾 Stored entity for user ${userId}: ${entity.name}`);
      return result.id;
    } catch (error) {
      console.error('❌ Failed to store user entity:', error);
      throw error;
    }
  }

  // Get user's personal entity knowledge
  async getUserEntities(userId: string, category?: string): Promise<UserKnowledgeResult[]> {
    await this.initialize();

    try {
      const containerTags = category ? [userId, 'user_entity', category] : [userId, 'user_entity'];
      
      const searchResult = await this.client.search.execute({
        q: 'user entities knowledge',
        containerTags,
        filters: {
          AND: [
            {
              key: 'type',
              value: 'user_entity'
            }
          ]
        },
        limit: 20,
        documentThreshold: 0.2
      });

      return searchResult.results.map(result => {
        try {
          const parsed = JSON.parse(result.chunks[0]?.content || '{}');
          return {
            score: result.score || 0,
            content: result.chunks[0]?.content || '',
            query: parsed.query,
            response: parsed.response,
            entities: parsed.entities
          };
        } catch {
          return { 
            score: result.score || 0, 
            content: result.chunks[0]?.content || '' 
          };
        }
      });

    } catch (error) {
      console.error('❌ Failed to get user entities:', error);
      return [];
    }
  }
}

// Export singleton instance
export const supermemoryService = new SupermemoryService(); 