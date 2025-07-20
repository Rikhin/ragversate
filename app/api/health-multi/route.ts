import { NextResponse } from 'next/server';
import { multiHelixDB } from '../../lib/multi-helixdb';

export async function GET() {
  try {
    const modes = multiHelixDB.getAvailableModes();
    const healthStatus: Record<string, {
      healthy: boolean;
      cacheWarmed: boolean;
      port: number;
      status: string;
      error?: string;
    }> = {};

    // Check health of each instance
    for (const mode of modes) {
      try {
        const isHealthy = await multiHelixDB.healthCheck(mode);
        const isCacheWarmed = multiHelixDB.isCacheWarmed(mode);
        const port = multiHelixDB.getPort(mode);

        healthStatus[mode] = {
          healthy: isHealthy,
          cacheWarmed: isCacheWarmed,
          port,
          status: isHealthy ? 'online' : 'offline'
        };
      } catch (error) {
        healthStatus[mode] = {
          healthy: false,
          cacheWarmed: false,
          port: multiHelixDB.getPort(mode),
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    // Calculate overall health
    const allHealthy = Object.values(healthStatus).every(status => status.healthy);
    const allCachesWarmed = Object.values(healthStatus).every(status => status.cacheWarmed);

    return NextResponse.json({
      overall: {
        healthy: allHealthy,
        allCachesWarmed,
        totalInstances: modes.length,
        healthyInstances: Object.values(healthStatus).filter(status => status.healthy).length
      },
      instances: healthStatus,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      { 
        error: 'Health check failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 