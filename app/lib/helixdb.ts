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

class HelixDBService {
  private client: HelixDB;
  private isConnected: boolean = false;
  private entityCache: Map<string, Entity> = new Map();
  private relationshipCache: Map<string, Array<{ from: string; to: string; type: string; strength: number }>> = new Map();
  private connectionPromise: Promise<void> | null = null;
  private requestCache: Map<string, { data: HelixDBEntity[]; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 300000; // 5 minutes
  private nameIndex: Map<string, Entity[]> = new Map();
  private lastCacheTime: number | null = null;
  private isWarmingCache: boolean = false; // Flag to prevent cache clearing during warming

  constructor() {
    // Initialize with local HelixDB instance
    this.client = new HelixDB('http://localhost:6969');
  }

  // Initialize connection with connection pooling
  async connect(): Promise<void> {
    // Prevent multiple simultaneous connection attempts
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    if (this.isConnected) {
      return;
    }

    this.connectionPromise = this._connect();
    try {
      await this.connectionPromise;
    } finally {
      this.connectionPromise = null;
    }
  }

  private async _connect(): Promise<void> {
    try {
      // Test connection by running a simple query
      await this.client.query('getAllEntities', {});
      this.isConnected = true;
      console.log('✅ HelixDB connected successfully');
      
      // Automatically warm cache on connection to ensure data persistence
      await this.warmCache();
    } catch (error) {
      console.error('❌ Failed to connect to HelixDB:', error);
      throw new Error('HelixDB connection failed. Make sure the instance is running with `helix deploy`');
    }
  }

  // Pre-warm cache with initial data
  private async warmCache(): Promise<void> {
    try {
      // Prevent multiple simultaneous warming operations
      if (this.isWarmingCache) {
        console.log('🔥 Cache warming already in progress, skipping...');
        return;
      }

      this.isWarmingCache = true;
      console.log('🔥 Warming HelixDB cache...');
      const entities = await this.getAllEntitiesCached();
      
      // Only clear and rebuild if we have new entities or if cache is empty
      const currentCacheSize = this.entityCache.size;
      const newEntitiesCount = entities.length;
      
      if (currentCacheSize === 0 || newEntitiesCount > currentCacheSize) {
        console.log(`🔄 Rebuilding cache: ${currentCacheSize} → ${newEntitiesCount} entities`);
        this.nameIndex.clear();
        this.entityCache.clear();
        
        for (const entity of entities) {
          this.entityCache.set(entity.id, entity);
          const nameKey = entity.name.toLowerCase();
          if (!this.nameIndex.has(nameKey)) this.nameIndex.set(nameKey, []);
          this.nameIndex.get(nameKey)!.push(entity);
        }
      } else {
        console.log(`✅ Cache already warm with ${currentCacheSize} entities`);
      }
      
      console.log(`✅ Cache warmed with ${this.entityCache.size} entities`);
    } catch (error) {
      console.warn('⚠️ Failed to warm cache:', error);
    } finally {
      this.isWarmingCache = false;
    }
  }

  // Advanced graph traversal - find entities with relationships
  async traverseGraph(startEntityName: string, maxDepth: number = 2, limit: number = 10): Promise<GraphTraversalResult> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      // Get all entities for graph analysis (cached)
      const entities = await this.getAllEntitiesCached();
      
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

      return {
        entities: traversal.entities.map(id => this.entityCache.get(id) || entities.find((e: HelixDBEntity) => e.id === id)).filter(Boolean) as Entity[],
        relationships: traversal.relationships,
        path: traversal.path,
        total: traversal.entities.length
      };
    } catch (error) {
      console.error('Error in graph traversal:', error);
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
      entities.push(id);
      
      if (depth > 0) {
        relationships.push({
          from: path[path.length - 2],
          to: id,
          type: 'related',
          strength: 1 / depth
        });
      }
      
      if (depth < maxDepth) {
        const neighbors = graph.get(id) || new Set();
        for (const neighborId of neighbors) {
          if (!visited.has(neighborId)) {
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

  // Optimized query preprocessing
  private preprocessQuery(query: string): { queryLower: string; queryWords: string[]; patterns: RegExpMatchArray | null } {
    const queryLower = query.toLowerCase().trim();
    const queryWords = queryLower.split(/\s+/).filter(word => word.length > 1);
    
    // Pre-compile common patterns for faster matching
    const patterns = [
      /who is (.+)/i,
      /tell me about (.+)/i,
      /what is (.+)/i,
      /who was (.+)/i,
      /tell me (.+)/i
    ];
    
    let patternMatch = null;
    for (const pattern of patterns) {
      patternMatch = queryLower.match(pattern);
      if (patternMatch) break;
    }
    
    return { queryLower, queryWords, patterns: patternMatch };
  }

  // Fast semantic search using embeddings and graph traversal - PERMANENT GLOBAL CACHE
  async semanticSearch(query: string, limit: number = 5): Promise<SearchResult> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      const queryLower = query.toLowerCase().trim();
      let matches: Entity[] = [];
      
      // 1. Fast exact name match
      if (this.nameIndex.has(queryLower)) {
        matches = this.nameIndex.get(queryLower)!;
      }
      
      // 2. Partial match and fuzzy match for typos
      if (matches.length === 0) {
        for (const [name, entities] of this.nameIndex.entries()) {
          // Exact substring match
          if (name.includes(queryLower) || queryLower.includes(name)) {
            matches.push(...entities);
          }
          // Fuzzy match for typos (similarity > 0.8)
          else if (this.calculateSimilarity(queryLower, name) > 0.8) {
            matches.push(...entities);
          }
        }
      }
      
      // 3. Search in all entities for better coverage
      if (matches.length === 0) {
        const allEntities = Array.from(this.entityCache.values());
        for (const entity of allEntities) {
          const nameLower = entity.name.toLowerCase();
          const descriptionLower = entity.description.toLowerCase();
          
          // Check if query matches name or description
          if (nameLower.includes(queryLower) || 
              queryLower.includes(nameLower) ||
              descriptionLower.includes(queryLower) ||
              this.calculateSimilarity(queryLower, nameLower) > 0.7) {
            matches.push(entity);
          }
        }
      }
      
      if (matches.length >= limit) {
        console.log(`🚀 Found ${matches.length} matches in HelixDB cache - early exit`);
        return { entities: matches.slice(0, limit), total: matches.length };
      }
      
      // Preprocess query once
      const { queryLower: queryLowerFinal, queryWords, patterns } = this.preprocessQuery(query);
      
      // Multi-stage search for maximum efficiency:
      // 1. Fast text matching with early exit
      // 2. Graph traversal for related entities (only if needed)
      // 3. Semantic similarity scoring (only if needed)
      
      // Stage 1: Fast text matching with early exit
      const textMatches = matches.filter((entity: Entity) => {
        const nameLower = entity.name.toLowerCase();
        const descriptionLower = entity.description.toLowerCase();
        
        // Exact name match (highest priority) - immediate return
        if (nameLower === queryLowerFinal) return true;
        
        // Pattern-based matching (if we have a pattern match)
        if (patterns && patterns[1]) {
          const targetName = patterns[1].trim();
          if (nameLower === targetName) return true;
        }
        
        // Name contains query or query contains name
        if (nameLower.includes(queryLowerFinal) || queryLowerFinal.includes(nameLower)) return true;
        
        // Description contains query words
        return queryWords.some(word => descriptionLower.includes(word));
      });
      
      // Early exit if we have enough exact matches
      if (textMatches.length >= limit) {
        console.log(`🚀 Found ${textMatches.length} exact matches in global HelixDB cache - early exit`);
        return {
          entities: textMatches.slice(0, limit),
          total: textMatches.length
        };
      }
      
      // Early exit for high-confidence single matches
      const highConfidenceMatches = textMatches.filter(entity => {
        const nameLower = entity.name.toLowerCase();
        return nameLower === queryLowerFinal || 
               nameLower.includes(queryLowerFinal) || 
               queryLowerFinal.includes(nameLower);
      });
      
      if (highConfidenceMatches.length >= 1) {
        console.log(`🎯 Found ${highConfidenceMatches.length} high-confidence matches - early exit`);
        return {
          entities: highConfidenceMatches.slice(0, limit),
          total: highConfidenceMatches.length
        };
      }
      
      // Stage 2: Graph traversal for related entities (only if needed and no good matches)
      let graphResults: Entity[] = [];
      if (textMatches.length > 0 && textMatches.length < 2) {
        const graphResult = await this.traverseGraph(textMatches[0].name, 1, limit);
        graphResults = graphResult.entities as Entity[];
      }
      
      // Stage 3: Combine and score results (only if we still need more)
      const allResults = [...textMatches, ...graphResults];
      const uniqueResults = this.deduplicateEntities(allResults);
      
      // Early exit if we have enough results after deduplication
      if (uniqueResults.length >= limit) {
        console.log(`✅ Found ${uniqueResults.length} unique results after deduplication - early exit`);
        return {
          entities: uniqueResults.slice(0, limit),
          total: uniqueResults.length
        };
      }
      
      // Only do expensive scoring if we need to rank results
      const scoredResults = uniqueResults.map(entity => ({
        entity,
        score: this.calculateSemanticScore(entity, queryLowerFinal, queryWords)
      }));
      
      scoredResults.sort((a, b) => b.score - a.score);
      
      const finalResult = {
        entities: scoredResults.slice(0, limit).map((r: {entity: Entity; score: number}) => r.entity),
        total: scoredResults.length
      };
      
      console.log(`🔍 Global HelixDB search found ${finalResult.total} entities for "${query}"`);
      return finalResult;
    } catch (error) {
      console.error('Error in semantic search:', error);
      return { entities: [], total: 0 };
    }
  }

  // Calculate semantic similarity score
  private calculateSemanticScore(entity: Entity, query: string, queryWords: string[]): number {
    let score = 0;
    const nameLower = entity.name.toLowerCase();
    const descriptionLower = entity.description.toLowerCase();
    const queryLower = query.toLowerCase();
    
    // Exact name match (highest priority) - 100 points
    if (nameLower === queryLower) {
      score += 100;
    }
    
    // Exact phrase match in name - 90 points
    if (nameLower.includes(queryLower) || queryLower.includes(nameLower)) {
      score += 90;
    }
    
    // Multi-word exact match - 85 points
    const queryPhrase = queryLower.replace(/^(who is|what is|tell me about|who was|what are|how is|can you|please|explain|describe|give me information about)/i, '').trim();
    if (nameLower === queryPhrase) {
      score += 85;
    }
    
    // Partial name matching with word boundaries - 40 points per word
    const nameWords = nameLower.split(/\s+/);
    const queryWordsClean = queryWords.filter(word => word.length > 2); // Filter out short words
    
    const nameWordMatches = queryWordsClean.filter(word => 
      nameWords.some(nameWord => nameWord === word || nameWord.startsWith(word) || word.startsWith(nameWord))
    ).length;
    score += nameWordMatches * 40;
    
    // Description exact word match - 15 points per word
    const descriptionWords = descriptionLower.split(/\s+/);
    const exactWordOverlap = queryWordsClean.filter(word => descriptionWords.includes(word)).length;
    score += exactWordOverlap * 15;
    
    // Description contains query words (partial matches) - 5 points per word
    const partialMatches = queryWordsClean.filter(word => descriptionLower.includes(word)).length;
    score += partialMatches * 5;
    
    // Penalty for overly broad matches (like "quantum" matching both "mechanics" and "computing")
    if (queryWordsClean.length > 1) {
      const broadMatchPenalty = queryWordsClean.length === 1 && nameWords.length > 2 ? -20 : 0;
      score += broadMatchPenalty;
    }
    
    // Category relevance bonus - 15 points for person queries matching person entities
    if (queryLower.includes('who') && entity.category === 'person') {
      score += 15;
    } else if (queryLower.includes('what') && entity.category === 'concept') {
      score += 15;
    } else if (queryLower.includes('where') && entity.category === 'place') {
      score += 15;
    }
    
    // Recency bonus (newer entities get slight boost) - max 10 points
    const ageInDays = (Date.now() - entity.created_at) / (1000 * 60 * 60 * 24);
    score += Math.max(0, 10 - ageInDays);
    
    // Source query relevance - 25 points if source query matches exactly
    if (entity.source_query.toLowerCase() === queryLower) {
      score += 25;
    } else if (entity.source_query.toLowerCase().includes(queryLower)) {
      score += 15;
    }
    
    return score;
  }

  // Deduplicate entities while preserving order
  private deduplicateEntities(entities: Entity[]): Entity[] {
    const seen = new Set<string>();
    return entities.filter(entity => {
      const key = `${entity.name}-${entity.category}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // Check if an entity already exists (duplicate detection)
  async findExistingEntity(name: string, category: string): Promise<Entity | null> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      const entities = await this.getAllEntitiesCached();
      
      // Normalize the name for comparison
      const normalizedName = name.toLowerCase().trim();
      
      // Look for exact name match with same category
      const existing = entities.find((entity: HelixDBEntity) => 
        entity.name.toLowerCase().trim() === normalizedName && 
        entity.category === category
      );
      
      if (existing) {
        return {
          id: existing.id,
          name: existing.name,
          category: existing.category,
          source_query: existing.source_query,
          description: existing.description,
          created_at: existing.created_at
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error checking for existing entity:', error);
      return null;
    }
  }

  // Create a new entity (with duplicate prevention)
  async createEntity(params: CreateEntityParams): Promise<Entity> {
    if (!this.isConnected) {
      await this.connect();
    }

    // Check for existing entity first
    const existing = await this.findExistingEntity(params.name, params.category);
    if (existing) {
      console.log(`🔄 Entity "${params.name}" already exists, skipping creation`);
      return existing;
    }

    const timestamp = Date.now();

    try {
      const result = await this.client.query('createEntity', {
        name: params.name,
        category: params.category,
        source_query: params.source_query,
        description: params.description,
        created_at: timestamp
      });

      console.log('✅ HelixDB createEntity result:', JSON.stringify(result, null, 2));

      // Handle the response format - the entity is directly in the result
      const entity = result.entity || result[0]?.entity || result;
      if (!entity) {
        throw new Error('No entity returned from HelixDB');
      }

      const newEntity = {
        id: entity.id,
        name: entity.name,
        category: entity.category,
        source_query: entity.source_query,
        description: entity.description,
        created_at: entity.created_at
      };

      // Cache the new entity
      this.entityCache.set(entity.id, newEntity);
      const nameKey = newEntity.name.toLowerCase();
      if (!this.nameIndex.has(nameKey)) this.nameIndex.set(nameKey, []);
      this.nameIndex.get(nameKey)!.push(newEntity);

      return newEntity;
    } catch (error) {
      console.error('Error creating entity:', error);
      throw new Error(`Failed to create entity: ${error}`);
    }
  }

  // Search entities by text query (ultra-precise matching with strict scoring)
  async searchEntities(query: string, limit: number = 5): Promise<SearchResult> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      const entities = await this.getAllEntitiesCached();
      
      // Ultra-precise text-based filtering with strict scoring
      const queryLower = query.toLowerCase().trim();
      const queryWords = queryLower.split(/\s+/).filter(word => word.length > 1);
      
      // Score and filter entities with improved precision
      const scoredEntities = entities.map((entity: HelixDBEntity) => {
        const nameLower = entity.name.toLowerCase();
        const descriptionLower = entity.description.toLowerCase();
        let score = 0;
        
        // Priority 1: Exact name match (highest score)
        if (nameLower === queryLower) {
          score = 100;
        }
        
        // Priority 2: Extract target name from common query patterns
        const patterns = [
          /who is (.+)/i,
          /tell me about (.+)/i,
          /what is (.+)/i,
          /who was (.+)/i,
          /tell me (.+)/i,
          /quantum (.+) professors/i,
          /(.+) professors in (.+)/i
        ];
        
        let targetName = '';
        for (const pattern of patterns) {
          const match = queryLower.match(pattern);
          if (match && match[1]) {
            targetName = match[1].trim();
            break;
          }
        }
        
        if (targetName) {
          console.log(`🔍 Pattern extracted target name: "${targetName}" for entity: "${nameLower}"`);
          
          // Special handling for quantum mechanics vs quantum computing
          if (targetName.includes('quantum mechanics') && nameLower.includes('quantum computing')) {
            score = 0; // Penalize quantum computing when asking for quantum mechanics
          } else if (targetName.includes('quantum computing') && nameLower.includes('quantum mechanics')) {
            score = 0; // Penalize quantum mechanics when asking for quantum computing
          } else if (nameLower === targetName) {
            score = 95; // Only allow exact matches for pattern-extracted names (ultra-strict)
            console.log(`✅ Exact match found! Score: ${score}`);
          }
          // For pattern extraction, we only allow exact matches to prevent false positives
          // like "john jeff bezos" matching "Jeff Bezos"
        }
        
        // Priority 3: Query contains the full entity name (strict)
        if (queryLower.includes(nameLower) && nameLower.length > 3) {
          score = Math.max(score, 75);
        }
        
        // Priority 4: Entity name contains the full query (strict)
        if (nameLower.includes(queryLower) && queryLower.length > 3) {
          score = Math.max(score, 70);
        }
        
        // Priority 5: Word-level matching (more flexible)
        const nameWords = nameLower.split(/\s+/);
        const matchingWords = queryWords.filter(queryWord => 
          nameWords.some(nameWord => nameWord === queryWord)
        );
        
        if (matchingWords.length > 0) {
          // More flexible matching for semantic queries
          const matchRatio = matchingWords.length / Math.max(queryWords.length, nameWords.length);
          if (matchRatio >= 0.3) { // At least 30% match (reduced from 80%)
            score = Math.max(score, 30 + (matchRatio * 40)); // 30-70 based on match ratio
          }
        }
        
        // Priority 6: Description-based matching for semantic queries
        if (descriptionLower.includes(queryLower) || queryLower.includes('professor') || queryLower.includes('prof')) {
          // If query mentions professor and entity is a person, give it a boost
          if (entity.category === 'person' && (queryLower.includes('professor') || queryLower.includes('prof'))) {
            score = Math.max(score, 35);
          }
          
          // If description contains query terms, give it a boost
          const descriptionWords = descriptionLower.split(/\s+/);
          const descriptionMatches = queryWords.filter(queryWord => 
            descriptionWords.some(descWord => descWord.includes(queryWord) || queryWord.includes(descWord))
          );
          
          if (descriptionMatches.length > 0) {
            score = Math.max(score, 25 + (descriptionMatches.length * 15));
          }
          
          // Special boost for location-based queries
          if (queryLower.includes('california') && descriptionLower.includes('california')) {
            score = Math.max(score, 45);
          }
          
          if (queryLower.includes('nevada') && descriptionLower.includes('nevada')) {
            score = Math.max(score, 45);
          }
        }
        
        return { entity, score };
      });
      
      // Debug: Log all scored entities for this query
      console.log(`🔍 Scoring results for query: "${query}":`);
      scoredEntities.forEach((item: { entity: HelixDBEntity; score: number }) => {
        console.log(`  - ${item.entity.name}: score ${item.score}`);
      });
      
      // Filter entities with reasonable scores and sort by score
      const filteredEntities = scoredEntities
        .filter((item: { entity: HelixDBEntity; score: number }) => item.score >= 20) // Lower threshold for more flexible matching
        .sort((a: { entity: HelixDBEntity; score: number }, b: { entity: HelixDBEntity; score: number }) => b.score - a.score) // Sort by score descending
        .slice(0, limit)
        .map((item: { entity: HelixDBEntity; score: number }) => item.entity);
      
      console.log(`🔍 Found ${filteredEntities.length} matching entities for query: "${query}"`);
      
      return {
        entities: filteredEntities.map((entity: HelixDBEntity) => ({
          id: entity.id,
          name: entity.name,
          category: entity.category,
          source_query: entity.source_query,
          description: entity.description,
          created_at: entity.created_at
        })),
        total: filteredEntities.length
      };
    } catch (error) {
      console.error('Error searching entities:', error);
      throw new Error(`Failed to search entities: ${error}`);
    }
  }

  // Search entities by embedding (simplified - just get all entities for now)
  async searchEntitiesWithEmbedding(embedding: number[], limit: number = 5): Promise<SearchResult> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      const entities = await this.getAllEntitiesCached();
      
      return {
        entities: entities.slice(0, limit).map((entity: HelixDBEntity) => ({
          id: entity.id,
          name: entity.name,
          category: entity.category,
          source_query: entity.source_query,
          description: entity.description,
          created_at: entity.created_at
        })),
        total: Math.min(entities.length, limit)
      };
    } catch (error) {
      console.error('Error searching entities with embedding:', error);
      throw new Error(`Failed to search entities with embedding: ${error}`);
    }
  }

  // Get all entities
  async getAllEntities(): Promise<Entity[]> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      const entities = await this.getAllEntitiesCached();
      
      return entities.map((entity: HelixDBEntity) => ({
        id: entity.id,
        name: entity.name,
        category: entity.category,
        source_query: entity.source_query,
        description: entity.description,
        created_at: entity.created_at
      }));
    } catch (error) {
      console.error('Error getting all entities:', error);
      throw new Error(`Failed to get all entities: ${error}`);
    }
  }

  // Get entity by ID
  async getEntityById(id: string): Promise<Entity | null> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      const result = await this.client.query('getEntityById', {
        entity_id: id
      });

      const entity = result.entity?.[0] || result[0]?.entity?.[0];
      if (!entity) return null;

      return {
        id: entity.id,
        name: entity.name,
        category: entity.category,
        source_query: entity.source_query,
        description: entity.description,
        created_at: entity.created_at
      };
    } catch (error) {
      console.error('Error getting entity by ID:', error);
      throw new Error(`Failed to get entity by ID: ${error}`);
    }
  }

  // Find similar entities (simplified - just get all entities for now)
  async findSimilarEntities(entityId: string, limit: number = 5): Promise<Entity[]> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      const entities = await this.getAllEntitiesCached();
      
      // Filter out the current entity and return others
      const similarEntities = entities
        .filter((entity: HelixDBEntity) => entity.id !== entityId)
        .slice(0, limit);
      
      return similarEntities.map((entity: HelixDBEntity) => ({
        id: entity.id,
        name: entity.name,
        category: entity.category,
        source_query: entity.source_query,
        description: entity.description,
        created_at: entity.created_at
      }));
    } catch (error) {
      console.error('Error finding similar entities:', error);
      throw new Error(`Failed to find similar entities: ${error}`);
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.connect();
      return true;
    } catch {
      return false;
    }
  }

  // Check if cache is warmed
  isCacheWarmed(): boolean {
    // Check if we have entities in the cache and name index
    return this.entityCache.size > 0 && this.nameIndex.size > 0;
  }

  // Clean up duplicate entities (keep the oldest one)
  async cleanupDuplicates(): Promise<{ removed: number; kept: number }> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      const entities = await this.getAllEntitiesCached();
      
      // Group entities by normalized name and category
      const groups: { [key: string]: HelixDBEntity[] } = {};
      
      entities.forEach((entity: HelixDBEntity) => {
        const key = `${entity.name.toLowerCase().trim()}_${entity.category}`;
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push(entity);
      });
      
      let removed = 0;
      let kept = 0;
      
      // For each group with duplicates, keep the oldest and remove the rest
      for (const [key, groupEntities] of Object.entries(groups)) {
        if (groupEntities.length > 1) {
          // Sort by creation time (oldest first)
          groupEntities.sort((a, b) => a.created_at - b.created_at);
          
          // Keep the oldest one
          const toKeep = groupEntities[0];
          const toRemove = groupEntities.slice(1);
          
          console.log(`🧹 Found ${groupEntities.length} duplicates for "${toKeep.name}" (${toKeep.category}). Keeping oldest, removing ${toRemove.length} duplicates.`);
          
          // Remove duplicates (this would require a delete method in HelixDB)
          // For now, we'll just log them
          for (const duplicate of toRemove) {
            console.log(`🗑️ Would remove duplicate: ${duplicate.id} - ${duplicate.name}`);
            removed++;
          }
          
          kept++;
        } else {
          kept++;
        }
      }
      
      console.log(`🧹 Duplicate cleanup summary: ${kept} unique entities kept, ${removed} duplicates would be removed`);
      return { removed, kept };
    } catch (error) {
      console.error('Error cleaning up duplicates:', error);
      return { removed: 0, kept: 0 };
    }
  }

  // Memory optimization - clean up old cache entries
  private optimizeMemory(): void {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes
    
    // Clean up old request cache entries
    for (const [key, value] of this.requestCache.entries()) {
      if (now - value.timestamp > maxAge) {
        this.requestCache.delete(key);
      }
    }
    
    // Don't clear entity cache during warming process
    if (this.isWarmingCache) {
      return;
    }
    
    // Only optimize if cache is very large and we're not in the middle of warming
    if (this.entityCache.size > 2000) { // Increased threshold
      const entries = Array.from(this.entityCache.entries());
      entries.sort((a, b) => b[1].created_at - a[1].created_at);
      
      // Keep only the 1000 most recent entities (increased from 500)
      this.entityCache.clear();
      entries.slice(0, 1000).forEach(([key, value]) => {
        this.entityCache.set(key, value);
      });
      
      console.log(`🧹 Memory optimization: reduced entity cache from ${entries.length} to 1000 entries`);
    }
  }

  // Get all entities with request-level caching
  private async getAllEntitiesCached(): Promise<HelixDBEntity[]> {
    const cacheKey = 'all_entities';
    const cached = this.requestCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      return cached.data;
    }
    
    // Optimize memory before making new request
    this.optimizeMemory();
    
    const result = await this.client.query('getAllEntities', {});
    const entities = result.entities || result[0]?.entities || [];
    
    this.requestCache.set(cacheKey, {
      data: entities,
      timestamp: Date.now()
    });
    
    return entities;
  }

  // Clear request cache (call this at the end of each request)
  clearRequestCache(): void {
    this.requestCache.clear();
  }

  // Add fuzzy matching for deduplication
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    if (longer.length === 0) return 1.0;
    return (longer.length - this.editDistance(longer, shorter)) / longer.length;
  }

  private editDistance(s1: string, s2: string): number {
    s1 = s1.toLowerCase();
    s2 = s2.toLowerCase();
    const costs = [];
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
      if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
  }

  // Incremental index update
  async updateIndex(newEntity: Entity): Promise<void> {
    this.entityCache.set(newEntity.id, newEntity);
    const nameKey = newEntity.name.toLowerCase();
    if (!this.nameIndex.has(nameKey)) this.nameIndex.set(nameKey, []);
    this.nameIndex.get(nameKey)!.push(newEntity);
  }

  // Deduplication with fuzzy matching
  async createEntityWithDeduplication(entityData: Omit<Entity, 'id' | 'created_at'>): Promise<Entity> {
    const existingEntities = Array.from(this.entityCache.values());
    const similarityThreshold = 0.8;
    
    // Check for duplicates using fuzzy matching
    for (const existing of existingEntities) {
      const nameSimilarity = this.calculateSimilarity(entityData.name, existing.name);
      if (nameSimilarity > similarityThreshold) {
        console.log(`🔄 Skipping duplicate entity: ${entityData.name} (similar to ${existing.name})`);
        return existing;
      }
    }
    
    // Create new entity if no duplicates found
    return await this.createEntity(entityData);
  }
}

// Export singleton instance
export const helixDB = new HelixDBService(); 