import { NextRequest, NextResponse } from 'next/server';
import { helixDB } from '../../lib/helixdb';
import { popularEntitiesPrefetcher } from '../../lib/prefetch-popular-entities';
import { logger } from '../../lib/logging';

export async function POST(request: NextRequest) {
  try {
    logger.log('info', 'Starting optimization process');
    
    // 1. Load popular entities from file
    logger.log('info', 'Loading popular entities');
    await popularEntitiesPrefetcher.loadPopularEntities();
    
    // 2. Clean up old entries
    logger.log('info', 'Cleaning up old entries');
    popularEntitiesPrefetcher.cleanupOldEntries();
    
    // 3. Pre-fetch popular entities into HelixDB cache
    logger.log('info', 'Pre-fetching popular entities');
    await popularEntitiesPrefetcher.prefetchPopularEntities(helixDB);
    
    // 4. Warm up HelixDB cache
    logger.log('info', 'Warming HelixDB cache');
    // The cache warming happens automatically during connection
    await helixDB.connect();
    
    // 5. Log startup metrics
    const stats = popularEntitiesPrefetcher.getStats();
    logger.log('info', 'Startup statistics', stats);
    
    // 6. Log system health
    const isHealthy = await helixDB.healthCheck();
    logger.log('info', 'System health check', { isHealthy });
    
    logger.log('info', 'Optimization completed successfully');
    
    return NextResponse.json({
      success: true,
      message: 'Optimization completed successfully',
      stats,
      systemHealth: isHealthy
    });
    
  } catch (error) {
    logger.log('error', 'Optimization failed', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    return NextResponse.json({
      success: false,
      message: 'Optimization failed',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 