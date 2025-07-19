import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/app/lib/logging';

export async function GET(req: NextRequest) {
  try {
    const metrics = logger.getMetrics();
    const recentLogs = logger.getRecentLogs(50);
    
    // Calculate summary statistics
    const totalApiCalls = Object.values(metrics.apiCalls).reduce((sum, call) => sum + call.count, 0);
    const totalErrors = Object.values(metrics.errors).reduce((sum, count) => sum + count, 0);
    const avgResponseTime = totalApiCalls > 0 
      ? Object.values(metrics.apiCalls).reduce((sum, call) => sum + call.avgDuration * call.count, 0) / totalApiCalls
      : 0;

    const summary = {
      totalApiCalls,
      totalErrors,
      avgResponseTime: Math.round(avgResponseTime),
      cacheHitRates: Object.keys(metrics.cacheHits).reduce((acc, cacheType) => {
        acc[cacheType] = Math.round(logger.getCacheHitRate(cacheType) * 100);
        return acc;
      }, {} as Record<string, number>),
    };

    return NextResponse.json({
      summary,
      metrics,
      recentLogs,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error getting metrics:', error);
    return NextResponse.json(
      { error: 'Failed to get metrics' },
      { status: 500 }
    );
  }
} 