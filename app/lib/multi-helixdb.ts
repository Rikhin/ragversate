import HelixDB from 'helix-ts';

// Types for our entities
export interface Entity {
  id: string;
  name: string;
  category: string;
  source_query: string;
  description: string;
  created_at: number;
}

export interface CreateEntityParams {
  name: string;
  category: string;
  source_query: string;
  description: string;
  embedding?: number[];
}

export interface SearchResult {
  entities: Entity[];
  total: number;
}

export interface GraphTraversalResult {
  entities: Entity[];
  relationships: Array<{
    from: string;
    to: string;
    type: string;
    strength: number;
  }>;
  path: string[];
  total: number;
}

// Search modes
export type SearchMode = 'general' | 'summer-programs' | 'mentors' | 'scholarships';

// HelixDB response types
interface HelixDBEntity {
  id: string;
  name: string;
  category: string;
  source_query: string;
  description: string;
  created_at: number;
}

interface HelixDBResponse {
  [key: string]: HelixDBEntity[];
}

export type { ToolUsage } from './agentic-search';

class MultiHelixDBService {
  private clients: Map<SearchMode, HelixDB> = new Map();
  private connections: Map<SearchMode, boolean> = new Map();
  private entityCaches: Map<SearchMode, Map<string, Entity>> = new Map();
  private relationshipCaches: Map<SearchMode, Map<string, Array<{ from: string; to: string; type: string; strength: number }>>> = new Map();
  private connectionPromises: Map<SearchMode, Promise<void> | null> = new Map();
  private requestCaches: Map<SearchMode, Map<string, { data: HelixDBEntity[]; timestamp: number }>> = new Map();
  private readonly CACHE_TTL = 300000; // 5 minutes
  private nameIndices: Map<SearchMode, Map<string, Entity[]>> = new Map();
  private lastCacheTimes: Map<SearchMode, number | null> = new Map();
  private isWarmingCache: Map<SearchMode, boolean> = new Map();

  // Port configuration for different instances
  private readonly PORT_CONFIG: Record<SearchMode, number> = {
    'general': 6969,
    'summer-programs': 6970,
    'mentors': 6971,
    'scholarships': 6972
  };

  constructor() {
    // Initialize clients for all modes
    Object.entries(this.PORT_CONFIG).forEach(([mode, port]) => {
      this.clients.set(mode as SearchMode, new HelixDB(`http://localhost:${port}`));
      this.connections.set(mode as SearchMode, false);
      this.entityCaches.set(mode as SearchMode, new Map());
      this.relationshipCaches.set(mode as SearchMode, new Map());
      this.connectionPromises.set(mode as SearchMode, null);
      this.requestCaches.set(mode as SearchMode, new Map());
      this.nameIndices.set(mode as SearchMode, new Map());
      this.lastCacheTimes.set(mode as SearchMode, null);
      this.isWarmingCache.set(mode as SearchMode, false);
    });
  }

  // Initialize connection for a specific mode
  async connect(mode: SearchMode): Promise<void> {
    // Prevent multiple simultaneous connection attempts for the same mode
    if (this.connectionPromises.get(mode)) {
      return this.connectionPromises.get(mode)!;
    }

    if (this.connections.get(mode)) {
      return;
    }

    const connectionPromise = this._connect(mode);
    this.connectionPromises.set(mode, connectionPromise);
    
    try {
      await connectionPromise;
    } finally {
      this.connectionPromises.set(mode, null);
    }
  }

  private async _connect(mode: SearchMode): Promise<void> {
    try {
      const client = this.clients.get(mode)!;
      // Test connection by running a simple query
      await client.query('getAllEntities', {});
      this.connections.set(mode, true);
      console.log(`✅ HelixDB ${mode} connected successfully on port ${this.PORT_CONFIG[mode]}`);
      
      // Warm cache in background - don't block the connection
      const entityCache = this.entityCaches.get(mode)!;
      const lastCacheTime = this.lastCacheTimes.get(mode);
      
      if (entityCache.size === 0 || !lastCacheTime || Date.now() - lastCacheTime > 300000) {
        this.warmCache(mode).catch(error => console.warn(`⚠️ Background cache warming failed for ${mode}:`, error));
      } else {
        console.log(`✅ Using existing cache for ${mode} with ${entityCache.size} entities`);
      }
    } catch (error) {
      console.error(`❌ Failed to connect to HelixDB ${mode}:`, error);
      throw new Error(`HelixDB ${mode} connection failed. Make sure the instance is running on port ${this.PORT_CONFIG[mode]} with \`helix deploy\``);
    }
  }

  // Pre-warm cache with initial data for a specific mode
  private async warmCache(mode: SearchMode): Promise<void> {
    try {
      // Prevent multiple simultaneous warming operations for the same mode
      if (this.isWarmingCache.get(mode)) {
        console.log(`🔥 Cache warming already in progress for ${mode}, skipping...`);
        return;
      }

      const entityCache = this.entityCaches.get(mode)!;
      const lastCacheTime = this.lastCacheTimes.get(mode);
      const nameIndex = this.nameIndices.get(mode)!;
      
      // Only warm cache if it's been more than 10 minutes or cache is empty
      const timeSinceLastWarm = lastCacheTime ? Date.now() - lastCacheTime : Infinity;
      if (entityCache.size > 0 && timeSinceLastWarm < 600000) { // 10 minutes
        console.log(`✅ Cache already warm for ${mode} (${entityCache.size} entities, warmed ${Math.floor(timeSinceLastWarm / 60000)} minutes ago)`);
        return;
      }

      this.isWarmingCache.set(mode, true);
      console.log(`🔥 Warming HelixDB cache for ${mode}...`);
      const entities = await this.getAllEntitiesCached(mode);
      
      // Only clear and rebuild if we have new entities or if cache is empty
      const currentCacheSize = entityCache.size;
      const newEntitiesCount = entities.length;
      
      if (currentCacheSize === 0 || newEntitiesCount > currentCacheSize * 1.1) { // Only rebuild if 10% more entities
        console.log(`🔄 Rebuilding cache for ${mode}: ${currentCacheSize} → ${newEntitiesCount} entities`);
        nameIndex.clear();
        entityCache.clear();
        
        for (const entity of entities) {
          entityCache.set(entity.id, entity);
          const nameKey = entity.name.toLowerCase();
          if (!nameIndex.has(nameKey)) nameIndex.set(nameKey, []);
          nameIndex.get(nameKey)!.push(entity);
        }
      } else {
        console.log(`✅ Cache already warm for ${mode} with ${currentCacheSize} entities (no significant changes)`);
      }
      
      this.lastCacheTimes.set(mode, Date.now());
      console.log(`✅ Cache warmed for ${mode} with ${entityCache.size} entities`);
    } catch (error) {
      console.warn(`⚠️ Failed to warm cache for ${mode}:`, error);
    } finally {
      this.isWarmingCache.set(mode, false);
    }
  }

  // Advanced graph traversal - find entities with relationships for a specific mode
  async traverseGraph(mode: SearchMode, startEntityName: string, maxDepth: number = 2, limit: number = 10): Promise<GraphTraversalResult> {
    if (!this.connections.get(mode)) {
      await this.connect(mode);
    }

    try {
      // Get all entities for graph analysis (cached)
      const entities = await this.getAllEntitiesCached(mode);
      
      // Find starting entity
      const startEntity = entities.find((e: HelixDBEntity) => 
        e.name.toLowerCase().includes(startEntityName.toLowerCase()) ||
        startEntityName.toLowerCase().includes(e.name.toLowerCase())
      );

      if (!startEntity) {
        return { entities: [], relationships: [], path: [], total: 0 };
      }

      // Build relationship graph
      const graph = this.buildRelationshipGraph(entities);
      const traversal = this.performGraphTraversal(graph, startEntity.id, maxDepth, limit);

      const entityCache = this.entityCaches.get(mode)!;
      return {
        entities: traversal.entities.map(id => entityCache.get(id) || entities.find((e: HelixDBEntity) => e.id === id)).filter(Boolean) as Entity[],
        relationships: traversal.relationships,
        path: traversal.path,
        total: traversal.entities.length
      };
    } catch (error) {
      console.error(`Error in graph traversal for ${mode}:`, error);
      return { entities: [], relationships: [], path: [], total: 0 };
    }
  }

  // Build relationship graph from entities
  private buildRelationshipGraph(entities: HelixDBEntity[]): Map<string, Set<string>> {
    const graph = new Map<string, Set<string>>();
    
    for (const entity of entities) {
      if (!graph.has(entity.id)) {
        graph.set(entity.id, new Set());
      }
      
      // Find related entities based on:
      // 1. Same category
      // 2. Similar source queries
      // 3. Name mentions in descriptions
      // 4. Temporal proximity (created around same time)
      
      for (const otherEntity of entities) {
        if (entity.id === otherEntity.id) continue;
        
        let relationshipStrength = 0;
        
        // Category relationship
        if (entity.category === otherEntity.category) {
          relationshipStrength += 3;
        }
        
        // Source query similarity
        if (entity.source_query === otherEntity.source_query) {
          relationshipStrength += 5;
        }
        
        // Name mentions in description
        if (otherEntity.description.toLowerCase().includes(entity.name.toLowerCase()) ||
            entity.description.toLowerCase().includes(otherEntity.name.toLowerCase())) {
          relationshipStrength += 4;
        }
        
        // Temporal proximity (within 1 hour)
        const timeDiff = Math.abs(entity.created_at - otherEntity.created_at);
        if (timeDiff < 3600000) { // 1 hour in milliseconds
          relationshipStrength += 2;
        }
        
        // Add relationship if strong enough
        if (relationshipStrength >= 3) {
          graph.get(entity.id)!.add(otherEntity.id);
          if (!graph.has(otherEntity.id)) {
            graph.set(otherEntity.id, new Set());
          }
          graph.get(otherEntity.id)!.add(entity.id);
        }
      }
    }
    
    return graph;
  }

  // Perform BFS graph traversal
  private performGraphTraversal(
    graph: Map<string, Set<string>>, 
    startId: string, 
    maxDepth: number,
    limit: number
  ): { entities: string[], relationships: Array<{ from: string; to: string; type: string; strength: number }>, path: string[] } {
    const visited = new Set<string>();
    const queue: Array<{ id: string; depth: number; path: string[] }> = [{ id: startId, depth: 0, path: [startId] }];
    const entities: string[] = [];
    const relationships: Array<{ from: string; to: string; type: string; strength: number }> = [];

    while (queue.length > 0 && entities.length < limit) {
      const { id, depth, path } = queue.shift()!;
      
      if (visited.has(id) || depth > maxDepth) continue;
      visited.add(id);
      
      if (id !== startId) {
        entities.push(id);
      }

      if (depth < maxDepth) {
        const neighbors = graph.get(id) || new Set();
        for (const neighborId of neighbors) {
          if (!visited.has(neighborId) && entities.length < limit) {
            relationships.push({
              from: id,
              to: neighborId,
              type: 'related',
              strength: 0.8
            });
            
            queue.push({
              id: neighborId,
              depth: depth + 1,
              path: [...path, neighborId]
            });
          }
        }
      }
    }

    return { entities, relationships, path: [] };
  }

  // Preprocess query for better matching
  private preprocessQuery(query: string): { queryLower: string; queryWords: string[]; patterns: RegExpMatchArray | null } {
    const queryLower = query.toLowerCase().trim();
    const queryWords = queryLower.split(/\s+/).filter(word => word.length > 2);
    const patterns = queryLower.match(/\b\w+\b/g);
    
    return { queryLower, queryWords, patterns };
  }

  // Semantic search for a specific mode
  async semanticSearch(mode: SearchMode, query: string, limit: number = 5): Promise<SearchResult> {
    if (!this.connections.get(mode)) {
      await this.connect(mode);
    }

    try {
      const entityCache = this.entityCaches.get(mode)!;
      const allEntities = Array.from(entityCache.values());
      
      if (allEntities.length === 0) {
        console.log(`No entities found in cache for ${mode}`);
        return { entities: [], total: 0 };
      }

      // Simple search implementation - can be enhanced later
      const queryLower = query.toLowerCase();
      const filteredEntities = allEntities.filter(entity => 
        entity.name.toLowerCase().includes(queryLower) ||
        entity.description.toLowerCase().includes(queryLower) ||
        entity.category.toLowerCase().includes(queryLower)
      );

      return {
        entities: filteredEntities.slice(0, limit),
        total: filteredEntities.length
      };
    } catch (error) {
      console.error(`Error in semantic search for ${mode}:`, error);
      return { entities: [], total: 0 };
    }
  }

  // Calculate semantic similarity score
  private calculateSemanticScore(entity: Entity, query: string, queryWords: string[]): number {
    let score = 0;
    const entityNameLower = entity.name.toLowerCase();
    const entityDescLower = entity.description.toLowerCase();
    const entityCategoryLower = entity.category.toLowerCase();
    const entitySourceLower = entity.source_query.toLowerCase();

    // Exact name match (highest priority)
    if (entityNameLower === query.toLowerCase()) {
      score += 100;
    }

    // Name contains query or query contains name
    if (entityNameLower.includes(query.toLowerCase()) || query.toLowerCase().includes(entityNameLower)) {
      score += 50;
    }

    // Word-by-word matching in name
    for (const word of queryWords) {
      if (entityNameLower.includes(word)) {
        score += 20;
      }
    }

    // Description matching
    for (const word of queryWords) {
      if (entityDescLower.includes(word)) {
        score += 10;
      }
    }

    // Category matching
    for (const word of queryWords) {
      if (entityCategoryLower.includes(word)) {
        score += 15;
      }
    }

    // Source query matching
    for (const word of queryWords) {
      if (entitySourceLower.includes(word)) {
        score += 8;
      }
    }

    // Cosine similarity for description
    const descriptionSimilarity = this.calculateCosineSimilarity(entityDescLower, query.toLowerCase());
    score += descriptionSimilarity * 30;

    // Recency bonus (newer entities get slight boost)
    const ageInHours = (Date.now() - entity.created_at) / (1000 * 60 * 60);
    if (ageInHours < 24) {
      score += 5;
    }

    return score;
  }

  // Calculate cosine similarity between two text strings
  private calculateCosineSimilarity(text1: string, text2: string): number {
    const words1 = text1.toLowerCase().match(/\b\w+\b/g) || [];
    const words2 = text2.toLowerCase().match(/\b\w+\b/g) || [];
    
    const wordFreq1 = new Map<string, number>();
    const wordFreq2 = new Map<string, number>();
    
    // Count word frequencies
    words1.forEach(word => wordFreq1.set(word, (wordFreq1.get(word) || 0) + 1));
    words2.forEach(word => wordFreq2.set(word, (wordFreq2.get(word) || 0) + 1));
    
    // Get all unique words
    const allWords = new Set([...wordFreq1.keys(), ...wordFreq2.keys()]);
    
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;
    
    allWords.forEach(word => {
      const freq1 = wordFreq1.get(word) || 0;
      const freq2 = wordFreq2.get(word) || 0;
      
      dotProduct += freq1 * freq2;
      magnitude1 += freq1 * freq1;
      magnitude2 += freq2 * freq2;
    });
    
    if (magnitude1 === 0 || magnitude2 === 0) return 0;
    
    return dotProduct / (Math.sqrt(magnitude1) * Math.sqrt(magnitude2));
  }

  // Deduplicate entities based on name similarity
  private deduplicateEntities(entities: Entity[]): Entity[] {
    const seen = new Set<string>();
    return entities.filter(entity => {
      const nameKey = entity.name.toLowerCase();
      if (seen.has(nameKey)) return false;
      seen.add(nameKey);
      return true;
    });
  }

  // Find existing entity by name and category for a specific mode
  async findExistingEntity(mode: SearchMode, name: string, category: string): Promise<Entity | null> {
    if (!this.connections.get(mode)) {
      await this.connect(mode);
    }

    try {
      const entityCache = this.entityCaches.get(mode)!;
      const nameIndex = this.nameIndices.get(mode)!;
      
      // Check name index first
      const nameKey = name.toLowerCase();
      const candidates = nameIndex.get(nameKey) || [];
      
      // Find exact match
      const exactMatch = candidates.find(entity => 
        entity.name.toLowerCase() === nameKey && 
        entity.category.toLowerCase() === category.toLowerCase()
      );
      
      if (exactMatch) return exactMatch;
      
      // Check all entities for fuzzy match
      const allEntities = Array.from(entityCache.values());
      const fuzzyMatch = allEntities.find(entity => {
        const nameSimilarity = this.calculateSimilarity(entity.name.toLowerCase(), nameKey);
        const categoryMatch = entity.category.toLowerCase() === category.toLowerCase();
        return nameSimilarity > 0.8 && categoryMatch;
      });
      
      return fuzzyMatch || null;
    } catch (error) {
      console.error(`Error finding existing entity for ${mode}:`, error);
      return null;
    }
  }

  // Create entity for a specific mode
  async createEntity(mode: SearchMode, params: CreateEntityParams): Promise<Entity> {
    if (!this.connections.get(mode)) {
      await this.connect(mode);
    }

    try {
      const client = this.clients.get(mode)!;
      const entityCache = this.entityCaches.get(mode)!;
      const nameIndex = this.nameIndices.get(mode)!;
      
      // Check for existing entity
      const existing = await this.findExistingEntity(mode, params.name, params.category);
      if (existing) {
        console.log(`Entity already exists for ${mode}:`, existing.name);
        return existing;
      }

      // Create new entity
      const now = Date.now();
      const result = await client.query('createEntity', {
        name: params.name,
        category: params.category,
        source_query: params.source_query,
        description: params.description,
        created_at: now
      });

      if (!result || !result[0]) {
        throw new Error('Failed to create entity');
      }

      const newEntity: Entity = {
        id: result[0].id,
        name: params.name,
        category: params.category,
        source_query: params.source_query,
        description: params.description,
        created_at: now
      };

      // Update cache
      entityCache.set(newEntity.id, newEntity);
      const nameKey = newEntity.name.toLowerCase();
      if (!nameIndex.has(nameKey)) nameIndex.set(nameKey, []);
      nameIndex.get(nameKey)!.push(newEntity);

      console.log(`Created entity for ${mode}:`, newEntity.name);
      return newEntity;
    } catch (error) {
      console.error(`Error creating entity for ${mode}:`, error);
      throw error;
    }
  }

  // Search entities for a specific mode
  async searchEntities(mode: SearchMode, query: string, limit: number = 5): Promise<SearchResult> {
    return await this.semanticSearch(mode, query, limit);
  }

  // Search entities with embedding for a specific mode
  async searchEntitiesWithEmbedding(mode: SearchMode, embedding: number[], limit: number = 5): Promise<SearchResult> {
    if (!this.connections.get(mode)) {
      await this.connect(mode);
    }

    try {
      // For now, fall back to semantic search since we don't have vector search implemented
      // This can be enhanced later with proper vector similarity search
      const entityCache = this.entityCaches.get(mode)!;
      const allEntities = Array.from(entityCache.values());
      
      return {
        entities: allEntities.slice(0, limit),
        total: Math.min(allEntities.length, limit)
      };
    } catch (error) {
      console.error(`Error searching entities with embedding for ${mode}:`, error);
      return { entities: [], total: 0 };
    }
  }

  // Get all entities for a specific mode
  async getAllEntities(mode: SearchMode): Promise<Entity[]> {
    if (!this.connections.get(mode)) {
      await this.connect(mode);
    }

    try {
      const entityCache = this.entityCaches.get(mode)!;
      return Array.from(entityCache.values());
    } catch (error) {
      console.error(`Error getting all entities for ${mode}:`, error);
      return [];
    }
  }

  // Get entity by ID for a specific mode
  async getEntityById(mode: SearchMode, id: string): Promise<Entity | null> {
    if (!this.connections.get(mode)) {
      await this.connect(mode);
    }

    try {
      const entityCache = this.entityCaches.get(mode)!;
      return entityCache.get(id) || null;
    } catch (error) {
      console.error(`Error getting entity by ID for ${mode}:`, error);
      return null;
    }
  }

  // Find similar entities for a specific mode
  async findSimilarEntities(mode: SearchMode, entityId: string, limit: number = 5): Promise<Entity[]> {
    if (!this.connections.get(mode)) {
      await this.connect(mode);
    }

    try {
      const entityCache = this.entityCaches.get(mode)!;
      const targetEntity = entityCache.get(entityId);
      
      if (!targetEntity) {
        return [];
      }

      const allEntities = Array.from(entityCache.values());
      const scoredEntities = allEntities
        .filter(entity => entity.id !== entityId)
        .map(entity => ({
          entity,
          score: this.calculateCosineSimilarity(targetEntity.description, entity.description)
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(item => item.entity);

      return scoredEntities;
    } catch (error) {
      console.error(`Error finding similar entities for ${mode}:`, error);
      return [];
    }
  }

  // Health check for a specific mode
  async healthCheck(mode: SearchMode): Promise<boolean> {
    try {
      await this.connect(mode);
      return this.connections.get(mode) || false;
    } catch (error) {
      console.error(`Health check failed for ${mode}:`, error);
      return false;
    }
  }

  // Check if cache is warmed for a specific mode
  isCacheWarmed(mode: SearchMode): boolean {
    const entityCache = this.entityCaches.get(mode)!;
    return entityCache.size > 0;
  }

  // Cleanup duplicates for a specific mode
  async cleanupDuplicates(mode: SearchMode): Promise<{ removed: number; kept: number }> {
    if (!this.connections.get(mode)) {
      await this.connect(mode);
    }

    try {
      const entityCache = this.entityCaches.get(mode)!;
      const allEntities = Array.from(entityCache.values());
      
      const seen = new Map<string, Entity>();
      const duplicates: Entity[] = [];
      
      for (const entity of allEntities) {
        const key = `${entity.name.toLowerCase()}_${entity.category.toLowerCase()}`;
        if (seen.has(key)) {
          duplicates.push(entity);
        } else {
          seen.set(key, entity);
        }
      }
      
      // Remove duplicates from cache
      for (const duplicate of duplicates) {
        entityCache.delete(duplicate.id);
      }
      
      console.log(`Cleaned up ${duplicates.length} duplicates for ${mode}`);
      return { removed: duplicates.length, kept: seen.size };
    } catch (error) {
      console.error(`Error cleaning up duplicates for ${mode}:`, error);
      return { removed: 0, kept: 0 };
    }
  }

  // Optimize memory usage
  private optimizeMemory(): void {
    // Clear old request cache entries
    this.requestCaches.forEach((cache, mode) => {
      const now = Date.now();
      for (const [key, value] of cache.entries()) {
        if (now - value.timestamp > this.CACHE_TTL) {
          cache.delete(key);
        }
      }
    });
  }

  // Get all entities from cache for a specific mode
  private async getAllEntitiesCached(mode: SearchMode): Promise<HelixDBEntity[]> {
    try {
      const client = this.clients.get(mode)!;
      const result = await client.query('getAllEntities', {});
      
      if (!result || !Array.isArray(result)) {
        console.warn(`No entities found for ${mode}`);
        return [];
      }
      
      return result.map((entity: HelixDBEntity) => ({
        id: entity.id,
        name: entity.name,
        category: entity.category,
        source_query: entity.source_query,
        description: entity.description,
        created_at: entity.created_at
      }));
    } catch (error) {
      console.error(`Error getting all entities from cache for ${mode}:`, error);
      return [];
    }
  }

  // Clear request cache for a specific mode
  clearRequestCache(mode: SearchMode): void {
    const requestCache = this.requestCaches.get(mode)!;
    requestCache.clear();
  }

  // Calculate similarity between two strings
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.editDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  // Calculate edit distance between two strings
  private editDistance(s1: string, s2: string): number {
    const costs: number[] = [];
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) {
        costs[s2.length] = lastValue;
      }
    }
    return costs[s2.length];
  }

  // Update index for a specific mode
  async updateIndex(mode: SearchMode, newEntity: Entity): Promise<void> {
    const entityCache = this.entityCaches.get(mode)!;
    const nameIndex = this.nameIndices.get(mode)!;
    
    entityCache.set(newEntity.id, newEntity);
    const nameKey = newEntity.name.toLowerCase();
    if (!nameIndex.has(nameKey)) nameIndex.set(nameKey, []);
    nameIndex.get(nameKey)!.push(newEntity);
  }

  // Create entity with deduplication for a specific mode
  async createEntityWithDeduplication(mode: SearchMode, entityData: Omit<Entity, 'id' | 'created_at'>): Promise<Entity> {
    const existing = await this.findExistingEntity(mode, entityData.name, entityData.category);
    if (existing) {
      return existing;
    }

    return await this.createEntity(mode, {
      ...entityData,
      source_query: entityData.source_query || '',
      description: entityData.description || ''
    });
  }

  // Get port for a specific mode
  getPort(mode: SearchMode): number {
    return this.PORT_CONFIG[mode];
  }

  // Get all available modes
  getAvailableModes(): SearchMode[] {
    return Object.keys(this.PORT_CONFIG) as SearchMode[];
  }
}

// Export singleton instance
export const multiHelixDB = new MultiHelixDBService(); 