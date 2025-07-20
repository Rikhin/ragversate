import OpenAI from 'openai';

export interface CachedResponse {
  query: string;
  queryEmbedding: number[];
  answer: string;
  source: string;
  performance: unknown;
  reasoning: string;
  toolUsage: unknown[];
  agentDecisions: unknown[];
  timestamp: number;
  similarity: number;
}

// Define an interface for the expected data shape
interface CachedData {
  answer: string;
  source: string;
  performance: unknown;
  reasoning: string;
  toolUsage: unknown[];
  agentDecisions: unknown[];
}

export class SemanticCache {
  private cache = new Map<string, CachedResponse>();
  private embeddingCache = new Map<string, { embedding: number[]; timestamp: number }>(); // NEW: Embedding cache
  private readonly CACHE_TTL = 300000; // 5 minutes
  private readonly EMBEDDING_CACHE_TTL = 3600000; // 1 hour for embeddings
  private readonly SIMILARITY_THRESHOLD = 0.7; // Lower threshold for better cache hits
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async getCachedResponse(query: string, userId?: string): Promise<CachedResponse | null> {
    // Check embedding cache first - MAJOR SPEED IMPROVEMENT
    const queryEmbedding = await this.getCachedEmbedding(query);
    
    let bestMatch: CachedResponse | null = null;
    let bestSimilarity = 0;

    console.log(`🔍 [SEMANTIC-CACHE] Checking cache for: "${query}" (${this.cache.size} cached items)`);

    // Find the most similar cached response
    for (const [key, cached] of this.cache.entries()) {
      // Check if cache entry is still valid
      if (Date.now() - cached.timestamp > this.CACHE_TTL) {
        this.cache.delete(key);
        continue;
      }

      // Calculate cosine similarity
      const similarity = this.cosineSimilarity(queryEmbedding, cached.queryEmbedding);
      
      console.log(`   Comparing with "${cached.query}": ${(similarity * 100).toFixed(1)}% similarity`);
      
      if (similarity > bestSimilarity && similarity >= this.SIMILARITY_THRESHOLD) {
        bestSimilarity = similarity;
        bestMatch = { ...cached, similarity };
      }
    }

    if (bestMatch) {
      console.log(`🧠 [SEMANTIC-CACHE] Found similar query with ${(bestSimilarity * 100).toFixed(1)}% similarity`);
      console.log(`   Original: "${bestMatch.query}"`);
      console.log(`   Current:  "${query}"`);
    } else {
      console.log(`❌ [SEMANTIC-CACHE] No similar queries found (threshold: ${(this.SIMILARITY_THRESHOLD * 100).toFixed(1)}%)`);
    }

    return bestMatch;
  }

  async cacheResponse(
    query: string, 
    userId: string | undefined, 
    data: unknown
  ): Promise<void> {
    // Use cached embedding - MAJOR SPEED IMPROVEMENT
    const queryEmbedding = await this.getCachedEmbedding(query);
    const key = this.generateKey(query, userId);
    
    const { answer, source, performance, reasoning, toolUsage, agentDecisions } = data as CachedData;

    const cachedResponse: CachedResponse = {
      query,
      queryEmbedding,
      answer,
      source,
      performance,
      reasoning,
      toolUsage,
      agentDecisions,
      timestamp: Date.now(),
      similarity: 1.0
    };

    this.cache.set(key, cachedResponse);
    console.log(`💾 [SEMANTIC-CACHE] Cached response for: "${query}"`);
  }

  private async getEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
        dimensions: 1536
      });
      
      return response.data[0].embedding;
    } catch (error) {
      console.warn('Failed to get embedding, using fallback:', error);
      // Fallback: simple hash-based embedding
      return this.simpleHashEmbedding(text);
    }
  }

  private simpleHashEmbedding(text: string): number[] {
    // Simple fallback embedding for when OpenAI is unavailable
    const hash = this.hashString(text);
    const embedding = new Array(1536).fill(0);
    
    for (let i = 0; i < Math.min(hash.length, 1536); i++) {
      embedding[i] = (hash.charCodeAt(i) % 100) / 100;
    }
    
    return embedding;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private generateKey(query: string, userId?: string): string {
    return `${userId || 'anonymous'}_${this.hashString(query)}`;
  }

  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  clearCache(): void {
    this.cache.clear();
  }

  // NEW: Cached embedding method - ELIMINATES API CALL BOTTLENECK
  private async getCachedEmbedding(text: string): Promise<number[]> {
    const textHash = this.hashString(text);
    
    // Check embedding cache first
    const cached = this.embeddingCache.get(textHash);
    if (cached && Date.now() - cached.timestamp < this.EMBEDDING_CACHE_TTL) {
      console.log(`🚀 [SEMANTIC-CACHE] Embedding cache hit for: "${text.substring(0, 50)}..."`);
      return cached.embedding;
    }
    
    // Generate new embedding
    const embedding = await this.getEmbedding(text);
    
    // Cache the embedding
    this.embeddingCache.set(textHash, {
      embedding,
      timestamp: Date.now()
    });
    
    console.log(`⚡ [SEMANTIC-CACHE] Generated and cached embedding for: "${text.substring(0, 50)}..."`);
    return embedding;
  }
}

// Export singleton instance
export const semanticCache = new SemanticCache(); 