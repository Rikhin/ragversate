#!/usr/bin/env node

import { helixDB } from '../app/lib/helixdb';
import { popularEntitiesPrefetcher } from '../app/lib/prefetch-popular-entities';
import { logger } from '../app/lib/logging';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

async function startupOptimization() {
  console.log('🚀 Starting ragchat optimization...');
  
  try {
    // 1. Load popular entities from file
    console.log('📂 Loading popular entities...');
    await popularEntitiesPrefetcher.loadPopularEntities();
    
    // 2. Clean up old entries
    console.log('🧹 Cleaning up old entries...');
    popularEntitiesPrefetcher.cleanupOldEntries();
    
    // 3. Pre-fetch popular entities into HelixDB cache
    console.log('🔥 Pre-fetching popular entities...');
    await popularEntitiesPrefetcher.prefetchPopularEntities(helixDB);
    
    // 4. Warm up HelixDB cache (only if needed)
    console.log('🔥 Warming HelixDB cache...');
    // Removed redundant cache warming - HelixDB handles its own caching
    
    // 5. Log startup metrics
    const stats = popularEntitiesPrefetcher.getStats();
    console.log('📊 Startup statistics:', stats);
    
    // 6. Log system health
    const isHealthy = await helixDB.healthCheck();
    console.log(`🏥 System health: ${isHealthy ? '✅ Healthy' : '❌ Unhealthy'}`);
    
    console.log('🎉 Startup optimization complete!');
    
    // Log startup completion
    logger.log('info', 'Startup optimization completed successfully', {
      popularEntities: stats.popularEntities,
      totalEntities: stats.totalEntities,
      systemHealth: isHealthy,
    });
    
  } catch (error) {
    console.error('❌ Startup optimization failed:', error);
    logger.log('error', 'Startup optimization failed', { error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startupOptimization();
}

export { startupOptimization }; 