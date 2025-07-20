import { helixDB } from './helixdb';
// Removed Supermemory import - not working due to rate limits
import { logger } from './logging';

// Safety flag - set to true to enable context engine (default: enabled)
const CONTEXT_ENGINE_ENABLED = process.env.CONTEXT_ENGINE_ENABLED !== 'false';

export interface ContextualUnderstanding {
  // Immediate context awareness
  currentTopics: string[];
  relatedEntities: Array<{ name: string; category: string; relevance: number }>;
  userPatterns: Array<{ pattern: string; frequency: number; lastUsed: number }>;
  conversationFlow: Array<{ query: string; response: string; timestamp: number }>;
  
  // Predictive context
  likelyNextQueries: string[];
  suggestedExpansions: Array<{ topic: string; confidence: number }>;
  contextGaps: Array<{ topic: string; importance: number }>;
  
  // Semantic understanding
  entityRelationships: Map<string, string[]>;
  topicHierarchy: Map<string, string[]>;
  queryIntent: 'explore' | 'clarify' | 'deepen' | 'compare' | 'summarize';
}

export interface ReactiveResponse {
  immediateAnswer?: string;
  contextAwareSuggestions: string[];
  relatedTopics: string[];
  confidence: number;
  reasoning: string;
}

class ContextEngine {
  private contextCache: Map<string, ContextualUnderstanding> = new Map();
  private globalPatterns: Map<string, { count: number; lastUsed: number; contexts: string[] }> = new Map();
  private entityGraph: Map<string, Set<string>> = new Map();
  private topicGraph: Map<string, Set<string>> = new Map();
  
  // Real-time context building
  private activeSessions: Map<string, {
    startTime: number;
    queries: string[];
    entities: string[];
    topics: string[];
  }> = new Map();

  constructor() {
    if (CONTEXT_ENGINE_ENABLED) {
      // Lazy initialization - don't initialize immediately
      console.log('🧠 Context Engine enabled (lazy initialization)');
    } else {
      console.log('⚠️ Context Engine is disabled. Set CONTEXT_ENGINE_ENABLED=true to enable.');
    }
  }

  // Safe wrapper for all context engine operations
  private async safeOperation<T>(operation: () => Promise<T>): Promise<T | null> {
    if (!CONTEXT_ENGINE_ENABLED) {
      return null;
    }
    
    try {
      return await operation();
    } catch (error) {
      logger.log('warn', 'Context Engine operation failed', { error: (error as Error).message });
      return null;
    }
  }

  private async initializeContextGraph(): Promise<void> {
    await this.safeOperation(async () => {
      try {
        // Build entity relationship graph from HelixDB (optimized for speed)
        const entities = await helixDB.getAllEntities();
        
        // Only process first 100 entities for faster initialization
        const entitiesToProcess = entities.slice(0, 100);
        
        for (const entity of entitiesToProcess) {
          this.entityGraph.set(entity.name, new Set());
          this.topicGraph.set(entity.category, new Set());
          
          // Find related entities based on descriptions and categories (limited scope)
          for (const otherEntity of entitiesToProcess) {
            if (entity.id !== otherEntity.id) {
              const relationship = this.calculateRelationship(entity, otherEntity);
              if (relationship > 0.5) { // Higher threshold for faster processing
                this.entityGraph.get(entity.name)!.add(otherEntity.name);
                this.topicGraph.get(entity.category)!.add(otherEntity.category);
              }
            }
          }
        }
        
        logger.log('info', 'Context graph initialized (optimized)', { 
          entities: this.entityGraph.size,
          topics: this.topicGraph.size,
          processed: entitiesToProcess.length,
          total: entities.length
        });
      } catch (error) {
        logger.log('warn', 'Failed to initialize context graph', { error: (error as Error).message });
      }
    });
  }

  private calculateRelationship(entity1: { category: string; description: string; name: string }, entity2: { category: string; description: string; name: string }): number {
    let score = 0;
    
    // Category relationship
    if (entity1.category === entity2.category) score += 0.4;
    
    // Description similarity
    const desc1 = entity1.description.toLowerCase();
    const desc2 = entity2.description.toLowerCase();
    const commonWords = desc1.split(' ').filter(word => desc2.includes(word));
    score += (commonWords.length / Math.max(desc1.split(' ').length, desc2.split(' ').length)) * 0.3;
    
    // Name similarity
    if (entity1.name.toLowerCase().includes(entity2.name.toLowerCase()) || 
        entity2.name.toLowerCase().includes(entity1.name.toLowerCase())) {
      score += 0.3;
    }
    
    return score;
  }

  // Main reactive context analysis
  async analyzeContext(query: string, _userId: string): Promise<ContextualUnderstanding | null> {
    return this.safeOperation(async () => {
      const startTime = Date.now();
      
      // Lazy initialize context graph if not done yet
      if (this.entityGraph.size === 0) {
        await this.initializeContextGraph();
      }
      
      // Get or create user context
      let context = this.contextCache.get(_userId);
      if (!context) {
        context = await this.buildInitialContext(_userId);
        this.contextCache.set(_userId, context);
      }

      // Update active session
      this.updateActiveSession(_userId, query);

      // Real-time context analysis
      const queryIntent = this.analyzeQueryIntent(query);
      const relatedEntities = await this.findRelatedEntities(query, context);
      const likelyNextQueries = this.predictNextQueries(query, context);
      const suggestedExpansions = this.suggestExpansions(query, context);

      // Update context with new information
      const updatedContext: ContextualUnderstanding = {
        ...context,
        currentTopics: this.extractTopics(query),
        relatedEntities,
        queryIntent,
        likelyNextQueries,
        suggestedExpansions,
        conversationFlow: [
          ...context.conversationFlow,
          { query, response: '', timestamp: Date.now() }
        ].slice(-10) // Keep last 10 interactions
      };

      this.contextCache.set(_userId, updatedContext);
      
      const duration = Date.now() - startTime;
      logger.log('info', 'Context analysis completed', { 
        userId: _userId, 
        duration, 
        entitiesFound: relatedEntities.length,
        intent: queryIntent 
      });

      return updatedContext;
    });
  }

  // Reactive response generation - like Cursor's immediate understanding
  async generateReactiveResponse(query: string, userId: string): Promise<ReactiveResponse | null> {
    return this.safeOperation(async () => {
      const context = await this.analyzeContext(query, userId);
      if (!context) {
        return {
          contextAwareSuggestions: [],
          relatedTopics: [],
          confidence: 0,
          reasoning: 'Context engine disabled or failed'
        };
      }
      
      // Check if we can answer immediately from context
      const immediateAnswer = await this.findImmediateAnswer(query, context);
      
      if (immediateAnswer) {
        return {
          immediateAnswer: immediateAnswer.answer,
          contextAwareSuggestions: this.generateContextualSuggestions(query, context),
          relatedTopics: this.findRelatedTopics(query, context),
          confidence: immediateAnswer.confidence,
          reasoning: `Answered from context: ${immediateAnswer.reasoning}`
        };
      }

      // Generate contextual suggestions even if we need to search
      return {
        contextAwareSuggestions: this.generateContextualSuggestions(query, context),
        relatedTopics: this.findRelatedTopics(query, context),
        confidence: 0.3, // Lower confidence when we need to search
        reasoning: 'Context analyzed, but search required for complete answer'
      };
    });
  }

  private async findImmediateAnswer(query: string, context: ContextualUnderstanding): Promise<{ answer: string; confidence: number; reasoning: string } | null> {
    // Check if query is about something we already know from context
    const queryLower = query.toLowerCase();
    
    // 1. Check conversation history for similar queries
    for (const interaction of context.conversationFlow) {
      if (this.calculateSimilarity(queryLower, interaction.query.toLowerCase()) > 0.8) {
        return {
          answer: interaction.response,
          confidence: 0.9,
          reasoning: 'Found similar query in conversation history'
        };
      }
    }

    // 2. Check if query is about related entities we've discussed
    for (const entity of context.relatedEntities) {
      if (queryLower.includes(entity.name.toLowerCase()) && entity.relevance > 0.7) {
        // We have high-confidence context about this entity
        return {
          answer: `Based on our previous discussion about ${entity.name}, this relates to ${entity.category}.`,
          confidence: entity.relevance,
          reasoning: `High-confidence context about ${entity.name}`
        };
      }
    }

    // 3. Check user patterns for predictable queries
    for (const pattern of context.userPatterns) {
      if (queryLower.includes(pattern.pattern) && pattern.frequency > 2) {
        return {
          answer: `I notice you often ask about ${pattern.pattern}. Let me provide a comprehensive answer.`,
          confidence: 0.7,
          reasoning: `Recognized user pattern: ${pattern.pattern}`
        };
      }
    }

    return null;
  }

  private generateContextualSuggestions(query: string, context: ContextualUnderstanding): string[] {
    const suggestions: string[] = [];
    const queryLower = query.toLowerCase();

    // 1. Topic-based suggestions
    for (const topic of context.currentTopics) {
      if (!queryLower.includes(topic.toLowerCase())) {
        suggestions.push(`Tell me more about ${topic}`);
      }
    }

    // 2. Entity-based suggestions
    for (const entity of context.relatedEntities.slice(0, 3)) {
      if (!queryLower.includes(entity.name.toLowerCase())) {
        suggestions.push(`What's the connection between this and ${entity.name}?`);
      }
    }

    // 3. Pattern-based suggestions
    for (const pattern of context.userPatterns.slice(0, 2)) {
      suggestions.push(`Would you like to explore ${pattern.pattern} further?`);
    }

    return suggestions.slice(0, 5); // Limit to 5 suggestions
  }

  private findRelatedTopics(query: string, context: ContextualUnderstanding): string[] {
    const topics: string[] = [];
    const queryLower = query.toLowerCase();

    // Find topics that are related to current query
    for (const topic of context.currentTopics) {
      if (this.topicGraph.has(topic)) {
        const related = this.topicGraph.get(topic)!;
        for (const relatedTopic of related) {
          if (!topics.includes(relatedTopic) && !queryLower.includes(relatedTopic.toLowerCase())) {
            topics.push(relatedTopic);
          }
        }
      }
    }

    return topics.slice(0, 5);
  }

  private analyzeQueryIntent(query: string): ContextualUnderstanding['queryIntent'] {
    const queryLower = query.toLowerCase();
    
    if (queryLower.includes('compare') || queryLower.includes('difference') || queryLower.includes('vs')) {
      return 'compare';
    }
    if (queryLower.includes('explain') || queryLower.includes('how') || queryLower.includes('why')) {
      return 'clarify';
    }
    if (queryLower.includes('more') || queryLower.includes('detail') || queryLower.includes('expand')) {
      return 'deepen';
    }
    if (queryLower.includes('summary') || queryLower.includes('overview') || queryLower.includes('brief')) {
      return 'summarize';
    }
    
    return 'explore';
  }

  private extractTopics(query: string): string[] {
    // Simple topic extraction - could be enhanced with NLP
    const topics: string[] = [];
    const words = query.toLowerCase().split(' ');
    
    // Extract potential topics (nouns, proper nouns)
    for (const word of words) {
      if (word.length > 3 && !['what', 'when', 'where', 'who', 'why', 'how', 'tell', 'about', 'more', 'the', 'and', 'or', 'but'].includes(word)) {
        topics.push(word);
      }
    }
    
    return topics.slice(0, 5);
  }

  private async findRelatedEntities(query: string, context: ContextualUnderstanding): Promise<Array<{ name: string; category: string; relevance: number }>> {
    const entities: Array<{ name: string; category: string; relevance: number }> = [];
    const queryLower = query.toLowerCase();

    // Check existing entities in context
    for (const entity of context.relatedEntities) {
      if (queryLower.includes(entity.name.toLowerCase()) || entity.name.toLowerCase().includes(queryLower)) {
        entities.push({ ...entity, relevance: Math.min(entity.relevance + 0.2, 1.0) });
      }
    }

    // Find new related entities from graph
    for (const [entityName, relatedEntities] of this.entityGraph.entries()) {
      if (queryLower.includes(entityName.toLowerCase())) {
        for (const relatedEntity of relatedEntities) {
          if (!entities.find(e => e.name === relatedEntity)) {
            entities.push({ name: relatedEntity, category: 'related', relevance: 0.6 });
          }
        }
      }
    }

    return entities.sort((a, b) => b.relevance - a.relevance).slice(0, 10);
  }

  private predictNextQueries(query: string, context: ContextualUnderstanding): string[] {
    const predictions: string[] = [];
    const queryLower = query.toLowerCase();

    // Based on conversation flow patterns
    if (context.conversationFlow.length > 0) {
      const lastQuery = context.conversationFlow[context.conversationFlow.length - 1].query;
      if (lastQuery.toLowerCase().includes('what') && queryLower.includes('how')) {
        predictions.push('Can you give me an example?');
        predictions.push('What are the benefits?');
      }
    }

    // Based on user patterns
    for (const pattern of context.userPatterns) {
      if (pattern.frequency > 1) {
        predictions.push(`Tell me more about ${pattern.pattern}`);
      }
    }

    return predictions.slice(0, 3);
  }

  private suggestExpansions(query: string, context: ContextualUnderstanding): Array<{ topic: string; confidence: number }> {
    const expansions: Array<{ topic: string; confidence: number }> = [];
    const queryLower = query.toLowerCase();

    // Suggest related topics from graph
    for (const topic of context.currentTopics) {
      if (this.topicGraph.has(topic)) {
        const related = this.topicGraph.get(topic)!;
        for (const relatedTopic of related) {
          if (!queryLower.includes(relatedTopic.toLowerCase())) {
            expansions.push({ topic: relatedTopic, confidence: 0.7 });
          }
        }
      }
    }

    return expansions.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
  }

  private updateActiveSession(userId: string, query: string): void {
    const session = this.activeSessions.get(userId) || {
      startTime: Date.now(),
      queries: [],
      entities: [],
      topics: []
    };

    session.queries.push(query);
    session.topics.push(...this.extractTopics(query));

    this.activeSessions.set(userId, session);
  }

  private async buildInitialContext(_userId: string): Promise<ContextualUnderstanding> {
    // Skip Supermemory calls for performance - use default context
    return {
      currentTopics: [],
      relatedEntities: [],
      userPatterns: [],
      conversationFlow: [],
      likelyNextQueries: [],
      suggestedExpansions: [],
      contextGaps: [],
      entityRelationships: new Map(),
      topicHierarchy: new Map(),
      queryIntent: 'explore'
    };
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = str1.toLowerCase().split(' ');
    const words2 = str2.toLowerCase().split(' ');
    const commonWords = words1.filter(word => words2.includes(word));
    return commonWords.length / Math.max(words1.length, words2.length);
  }

  // Update context after search results
  async updateContextWithResults(userId: string, query: string, results: { answer?: string; entities?: Array<{ name: string; category: string }> }): Promise<void> {
    await this.safeOperation(async () => {
      const context = this.contextCache.get(userId);
      if (!context) return;

      // Update conversation flow with actual response
      const updatedFlow = context.conversationFlow.map((interaction, index) => {
        if (index === context.conversationFlow.length - 1 && interaction.query === query) {
          return { ...interaction, response: results.answer || 'No response' };
        }
        return interaction;
      });

      // Learn from this interaction
      this.learnFromInteraction(query, results, context);

      this.contextCache.set(userId, {
        ...context,
        conversationFlow: updatedFlow
      });
    });
  }

  private learnFromInteraction(query: string, results: { answer?: string; entities?: Array<{ name: string; category: string }> }, context: ContextualUnderstanding): void {
    // Update user patterns
    const queryWords = query.toLowerCase().split(' ');
    for (const word of queryWords) {
      if (word.length > 3) {
        const pattern = this.globalPatterns.get(word) || { count: 0, lastUsed: 0, contexts: [] };
        pattern.count++;
        pattern.lastUsed = Date.now();
        pattern.contexts.push(context.currentTopics[0] || 'general');
        this.globalPatterns.set(word, pattern);
      }
    }

    // Update entity relationships if results contain entities
    if (results.entities) {
      for (const entity of results.entities) {
        if (!context.relatedEntities.find(e => e.name === entity.name)) {
          context.relatedEntities.push({
            name: entity.name,
            category: entity.category,
            relevance: 0.5
          });
        }
      }
    }
  }

  // Get context summary for debugging
  getContextSummary(userId: string): { topics: string[]; entities: number; patterns: number; conversationLength: number; lastIntent: string } | null {
    if (!CONTEXT_ENGINE_ENABLED) {
      return null;
    }
    
    const context = this.contextCache.get(userId);
    if (!context) return null;

    return {
      topics: context.currentTopics,
      entities: context.relatedEntities.length,
      patterns: context.userPatterns.length,
      conversationLength: context.conversationFlow.length,
      lastIntent: context.queryIntent
    };
  }

  // Check if context engine is enabled
  isEnabled(): boolean {
    return CONTEXT_ENGINE_ENABLED;
  }
}

export const contextEngine = new ContextEngine(); 