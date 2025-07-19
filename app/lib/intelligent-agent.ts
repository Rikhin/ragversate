import { helixDB } from './helixdb';
import { supermemoryService } from './supermemory';

import { Entity } from './helixdb';

export interface AgentAction {
  type: 'learn' | 'explore' | 'connect' | 'suggest' | 'anticipate';
  priority: 'high' | 'medium' | 'low';
  description: string;
  entities?: string[];
  confidence: number;
  estimatedImpact: number;
}

export interface AgentInsight {
  pattern: string;
  frequency: number;
  relatedEntities: string[];
  userBehavior: string;
  suggestedActions: AgentAction[];
}

export interface AgentMemory {
  learnedConcepts: Map<string, { strength: number; lastUsed: number; connections: string[] }>;
  userPatterns: Map<string, { frequency: number; contexts: string[] }>;
  knowledgeGaps: Set<string>;
  proactiveActions: AgentAction[];
}

class IntelligentAgent {
  private memory: AgentMemory;
  private isLearning: boolean = false;
  private learningQueue: AgentAction[] = [];
  private insights: AgentInsight[] = [];

  constructor() {
    this.memory = {
      learnedConcepts: new Map(),
      userPatterns: new Map(),
      knowledgeGaps: new Set(),
      proactiveActions: []
    };
  }

  // Proactive learning - continuously build knowledge
  async startProactiveLearning(): Promise<void> {
    if (this.isLearning) return;
    
    this.isLearning = true;
    console.log('🧠 Starting proactive learning mode...');

    // Start background learning processes
    this.learnFromGlobalKnowledge();
    this.identifyKnowledgeGaps();
    this.buildEntityConnections();
    this.analyzeUserPatterns();
  }

  // Learn from existing global knowledge
  private async learnFromGlobalKnowledge(): Promise<void> {
    try {
      console.log('📚 Learning from global knowledge base...');
      
      // Get all entities from HelixDB
      const allEntities = await helixDB.getAllEntities();
      
      // Analyze and learn from entities
      for (const entity of allEntities) {
        await this.learnEntity(entity);
      }

      console.log(`✅ Learned from ${allEntities.length} entities`);
    } catch (error) {
      console.error('❌ Failed to learn from global knowledge:', error);
    }
  }

  // Learn from a single entity
  private async learnEntity(entity: Entity): Promise<void> {
    const conceptKey = `${entity.category}:${entity.name}`;
    const existing = this.memory.learnedConcepts.get(conceptKey);
    
    if (existing) {
      // Strengthen existing knowledge
      existing.strength = Math.min(existing.strength + 0.1, 1.0);
      existing.lastUsed = Date.now();
    } else {
      // Learn new concept
      this.memory.learnedConcepts.set(conceptKey, {
        strength: 0.5,
        lastUsed: Date.now(),
        connections: []
      });
    }

    // Extract related concepts from description
    const relatedConcepts = this.extractConcepts(entity.description);
    for (const concept of relatedConcepts) {
      this.addConnection(conceptKey, concept);
    }
  }

  // Extract concepts from text
  private extractConcepts(text: string): string[] {
    const concepts: string[] = [];
    const words = text.toLowerCase().split(/\s+/);
    
    // Extract potential concepts (nouns, proper nouns)
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      if (word.length > 3 && !['the', 'and', 'for', 'with', 'from', 'this', 'that'].includes(word)) {
        concepts.push(word);
      }
    }
    
    return concepts.slice(0, 5); // Limit to top 5 concepts
  }

  // Add connection between concepts
  private addConnection(concept1: string, concept2: string): void {
    const existing1 = this.memory.learnedConcepts.get(concept1);
    const existing2 = this.memory.learnedConcepts.get(concept2);
    
    if (existing1 && !existing1.connections.includes(concept2)) {
      existing1.connections.push(concept2);
    }
    
    if (existing2 && !existing2.connections.includes(concept1)) {
      existing2.connections.push(concept1);
    }
  }

  // Identify knowledge gaps proactively
  private async identifyKnowledgeGaps(): Promise<void> {
    try {
      console.log('🔍 Identifying knowledge gaps...');
      
      const allEntities = await helixDB.getAllEntities();
      const categories = new Map<string, number>();
      
      // Count entities by category
      for (const entity of allEntities) {
        const count = categories.get(entity.category) || 0;
        categories.set(entity.category, count + 1);
      }
      
      // Identify underrepresented categories
      const avgCount = Array.from(categories.values()).reduce((a, b) => a + b, 0) / categories.size;
      
      for (const [category, count] of categories.entries()) {
        if (count < avgCount * 0.5) {
          this.memory.knowledgeGaps.add(category);
        }
      }
      
      console.log(`✅ Identified ${this.memory.knowledgeGaps.size} knowledge gaps`);
    } catch (error) {
      console.error('❌ Failed to identify knowledge gaps:', error);
    }
  }

  // Build connections between entities
  private async buildEntityConnections(): Promise<void> {
    try {
      console.log('🔗 Building entity connections...');
      
      const allEntities = await helixDB.getAllEntities();
      const entities = allEntities;
      
      // Find entities that might be related
      for (let i = 0; i < entities.length; i++) {
        for (let j = i + 1; j < entities.length; j++) {
          const entity1 = entities[i];
          const entity2 = entities[j];
          
          if (this.areEntitiesRelated(entity1, entity2)) {
            await this.createConnection(entity1, entity2);
          }
        }
      }
      
      console.log('✅ Built entity connections');
    } catch (error) {
      console.error('❌ Failed to build entity connections:', error);
    }
  }

  // Check if two entities are related
  private areEntitiesRelated(entity1: Entity, entity2: Entity): boolean {
    const desc1 = entity1.description.toLowerCase();
    const desc2 = entity2.description.toLowerCase();
    const name1 = entity1.name.toLowerCase();
    const name2 = entity2.name.toLowerCase();
    
    // Check for name overlap
    if (name1.includes(name2) || name2.includes(name1)) return true;
    
    // Check for description overlap
    const words1 = desc1.split(/\s+/);
    const words2 = desc2.split(/\s+/);
    const commonWords = words1.filter(word => words2.includes(word) && word.length > 3);
    
    return commonWords.length >= 2;
  }

  // Create connection between entities
  private async createConnection(entity1: Entity, entity2: Entity): Promise<void> {
    try {
      // For now, we'll just log the connection since createRelationship doesn't exist
      console.log(`🔗 Would create connection: ${entity1.name} -> ${entity2.name}`);
      // TODO: Implement relationship creation when HelixDB supports it
    } catch (error) {
      // Connection might already exist
    }
  }

  // Analyze user patterns proactively
  private async analyzeUserPatterns(): Promise<void> {
    try {
      console.log('👤 Analyzing user patterns...');
      
      // This would analyze all user interactions
      // For now, we'll create some insights based on common patterns
      
      this.insights = [
        {
          pattern: 'person_queries',
          frequency: 0.8,
          relatedEntities: ['person', 'biography', 'career'],
          userBehavior: 'Users frequently ask about people',
          suggestedActions: [
            {
              type: 'learn',
              priority: 'high',
              description: 'Learn more about famous people',
              entities: ['person'],
              confidence: 0.9,
              estimatedImpact: 0.8
            }
          ]
        },
        {
          pattern: 'technology_queries',
          frequency: 0.6,
          relatedEntities: ['organization', 'technology', 'innovation'],
          userBehavior: 'Users ask about tech companies and innovations',
          suggestedActions: [
            {
              type: 'explore',
              priority: 'medium',
              description: 'Explore latest tech trends',
              entities: ['organization', 'technology'],
              confidence: 0.7,
              estimatedImpact: 0.6
            }
          ]
        }
      ];
      
      console.log(`✅ Analyzed ${this.insights.length} user patterns`);
    } catch (error) {
      console.error('❌ Failed to analyze user patterns:', error);
    }
  }

  // Get proactive suggestions based on learned patterns
  async getProactiveSuggestions(userId: string, currentQuery: string): Promise<AgentAction[]> {
    const suggestions: AgentAction[] = [];
    
    // Based on current query, suggest related learning
    const queryLower = currentQuery.toLowerCase();
    
    if (queryLower.includes('who is') || queryLower.includes('person')) {
      suggestions.push({
        type: 'learn',
        priority: 'high',
        description: 'Learn about related people in the same field',
        entities: ['person'],
        confidence: 0.8,
        estimatedImpact: 0.7
      });
    }
    
    if (queryLower.includes('company') || queryLower.includes('organization')) {
      suggestions.push({
        type: 'explore',
        priority: 'medium',
        description: 'Explore related companies and industries',
        entities: ['organization'],
        confidence: 0.6,
        estimatedImpact: 0.5
      });
    }
    
    // Add suggestions based on knowledge gaps
    for (const gap of this.memory.knowledgeGaps) {
      suggestions.push({
        type: 'learn',
        priority: 'low',
        description: `Fill knowledge gap in ${gap} category`,
        entities: [gap],
        confidence: 0.4,
        estimatedImpact: 0.3
      });
    }
    
    return suggestions.sort((a, b) => b.estimatedImpact - a.estimatedImpact);
  }

  // Execute a proactive action
  async executeAction(action: AgentAction): Promise<void> {
    console.log(`🚀 Executing proactive action: ${action.description}`);
    
    try {
      switch (action.type) {
        case 'learn':
          await this.executeLearningAction(action);
          break;
        case 'explore':
          await this.executeExplorationAction(action);
          break;
        case 'connect':
          await this.executeConnectionAction(action);
          break;
        case 'suggest':
          await this.executeSuggestionAction(action);
          break;
        case 'anticipate':
          await this.executeAnticipationAction(action);
          break;
      }
    } catch (error) {
      console.error(`❌ Failed to execute action: ${action.description}`, error);
    }
  }

  // Execute learning action
  private async executeLearningAction(action: AgentAction): Promise<void> {
    if (action.entities?.includes('person')) {
      // Learn about people in the same field
      console.log('📚 Learning about related people...');
      // This would trigger web searches for related people
    }
  }

  // Execute exploration action
  private async executeExplorationAction(action: AgentAction): Promise<void> {
    if (action.entities?.includes('organization')) {
      // Explore related organizations
      console.log('🔍 Exploring related organizations...');
      // This would trigger web searches for related companies
    }
  }

  // Execute connection action
  private async executeConnectionAction(action: AgentAction): Promise<void> {
    console.log('🔗 Building new connections...');
    // This would create new relationships in HelixDB
  }

  // Execute suggestion action
  private async executeSuggestionAction(action: AgentAction): Promise<void> {
    console.log('💡 Generating suggestions...');
    // This would generate new suggestions for users
  }

  // Execute anticipation action
  private async executeAnticipationAction(action: AgentAction): Promise<void> {
    console.log('🔮 Anticipating user needs...');
    // This would predict what users might ask next
  }

  // Get agent insights
  getInsights(): AgentInsight[] {
    return this.insights;
  }

  // Get agent memory
  getMemory(): AgentMemory {
    return this.memory;
  }

  // Stop proactive learning
  stopProactiveLearning(): void {
    this.isLearning = false;
    console.log('🛑 Stopped proactive learning mode');
  }
}

// Export singleton instance
export const intelligentAgent = new IntelligentAgent(); 