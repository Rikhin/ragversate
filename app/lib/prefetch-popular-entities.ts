// Pre-fetch popular entities for instant access

interface PopularEntity {
  name: string;
  query: string;
  frequency: number;
  lastAccessed: number;
}

class PopularEntitiesPrefetcher {
  private popularEntities: Map<string, PopularEntity> = new Map();
  private readonly POPULAR_ENTITIES_FILE = 'popular-entities.json';
  private readonly MIN_FREQUENCY = 3; // Minimum queries to be considered popular
  private readonly MAX_POPULAR_ENTITIES = 100;

  // Track entity access for popularity
  trackEntityAccess(entityName: string, query: string): void {
    const key = entityName.toLowerCase();
    const existing = this.popularEntities.get(key);
    
    if (existing) {
      existing.frequency++;
      existing.lastAccessed = Date.now();
    } else {
      this.popularEntities.set(key, {
        name: entityName,
        query,
        frequency: 1,
        lastAccessed: Date.now(),
      });
    }

    // Save to file periodically
    this.savePopularEntities();
  }

  // Get popular entities that should be pre-fetched
  getPopularEntities(): PopularEntity[] {
    return Array.from(this.popularEntities.values())
      .filter(entity => entity.frequency >= this.MIN_FREQUENCY)
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, this.MAX_POPULAR_ENTITIES);
  }

  // Pre-fetch popular entities into HelixDB cache
  async prefetchPopularEntities(helixDB: { semanticSearch: (query: string, limit: number) => Promise<any[]> }): Promise<void> {
    try {
      console.log('🚀 Pre-fetching popular entities...');
      
      const popularEntities = this.getPopularEntities();
      console.log(`📊 Found ${popularEntities.length} popular entities to pre-fetch`);

      // Pre-fetch each popular entity
      for (const entity of popularEntities) {
        try {
          // Search for the entity in HelixDB to ensure it's cached
          await helixDB.semanticSearch(entity.name, 1);
          console.log(`✅ Pre-fetched: ${entity.name} (${entity.frequency} queries)`);
        } catch (error) {
          console.warn(`⚠️ Failed to pre-fetch ${entity.name}:`, error);
        }
      }

      console.log('🎉 Popular entities pre-fetch complete');
    } catch (error) {
      console.error('❌ Error pre-fetching popular entities:', error);
    }
  }

  // Load popular entities from file
  async loadPopularEntities(): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const data = await fs.readFile(this.POPULAR_ENTITIES_FILE, 'utf-8');
      const entities = JSON.parse(data);
      
      this.popularEntities.clear();
      entities.forEach((entity: PopularEntity) => {
        this.popularEntities.set(entity.name.toLowerCase(), entity);
      });
      
      console.log(`📂 Loaded ${this.popularEntities.size} popular entities from file`);
    } catch (error) {
      console.log('📂 No existing popular entities file found, starting fresh');
    }
  }

  // Save popular entities to file
  private async savePopularEntities(): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const entities = Array.from(this.popularEntities.values());
      await fs.writeFile(this.POPULAR_ENTITIES_FILE, JSON.stringify(entities, null, 2));
    } catch (error) {
      console.warn('⚠️ Failed to save popular entities:', error);
    }
  }

  // Get suggestions based on popular entities
  getSuggestions(partialQuery: string): string[] {
    const suggestions: string[] = [];
    const queryLower = partialQuery.toLowerCase();
    
    for (const entity of this.popularEntities.values()) {
      if (entity.name.toLowerCase().includes(queryLower) && 
          entity.frequency >= this.MIN_FREQUENCY) {
        suggestions.push(entity.name);
      }
    }
    
    return suggestions
      .sort((a, b) => {
        const aEntity = this.popularEntities.get(a.toLowerCase())!;
        const bEntity = this.popularEntities.get(b.toLowerCase())!;
        return bEntity.frequency - aEntity.frequency;
      })
      .slice(0, 5);
  }

  // Clean up old entries (older than 30 days)
  cleanupOldEntries(): void {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    let cleaned = 0;
    
    for (const [key, entity] of this.popularEntities.entries()) {
      if (entity.lastAccessed < thirtyDaysAgo && entity.frequency < this.MIN_FREQUENCY) {
        this.popularEntities.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} old popular entity entries`);
      this.savePopularEntities();
    }
  }

  // Get statistics about popular entities
  getStats(): {
    totalEntities: number;
    popularEntities: number;
    totalQueries: number;
    avgFrequency: number;
  } {
    const entities = Array.from(this.popularEntities.values());
    const popularEntities = entities.filter(e => e.frequency >= this.MIN_FREQUENCY);
    const totalQueries = entities.reduce((sum, e) => sum + e.frequency, 0);
    
    return {
      totalEntities: entities.length,
      popularEntities: popularEntities.length,
      totalQueries,
      avgFrequency: entities.length > 0 ? totalQueries / entities.length : 0,
    };
  }
}

// Singleton instance
export const popularEntitiesPrefetcher = new PopularEntitiesPrefetcher();

// Utility functions
export const trackEntityAccess = (entityName: string, query: string) => 
  popularEntitiesPrefetcher.trackEntityAccess(entityName, query);

export const getPopularEntities = () => 
  popularEntitiesPrefetcher.getPopularEntities();

export const prefetchPopularEntities = (helixDB: { semanticSearch: (query: string, limit: number) => Promise<any[]> }) => 
  popularEntitiesPrefetcher.prefetchPopularEntities(helixDB);

export const getSuggestions = (partialQuery: string) => 
  popularEntitiesPrefetcher.getSuggestions(partialQuery);

export const getPopularEntitiesStats = () => 
  popularEntitiesPrefetcher.getStats(); 