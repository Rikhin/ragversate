import { NextRequest, NextResponse } from 'next/server';
import { helixDB } from '@/app/lib/helixdb';

export async function GET(req: NextRequest) {
  try {
    // Check environment variables first
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
    const hasExaKey = !!process.env.EXA_API_KEY;
    const hasSupermemoryKey = !!process.env.SUPERMEMORY_API_KEY;
    
    // Check HelixDB connection and cache status (with error handling)
    let helixStatus = false;
    let cacheWarmed = false;
    try {
      helixStatus = await helixDB.healthCheck();
      cacheWarmed = helixDB.isCacheWarmed();
    } catch (error) {
      console.warn('HelixDB health check failed:', error);
    }
    
    const status = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        helixdb: {
          connected: helixStatus,
          cacheWarmed: cacheWarmed
        },
        openai: hasOpenAIKey ? 'configured' : 'missing_key',
        exa: hasExaKey ? 'configured' : 'missing_key',
        supermemory: hasSupermemoryKey ? 'configured' : 'missing_key'
      },
      environment: process.env.NODE_ENV || 'development',
      deployment: {
        platform: process.env.VERCEL ? 'vercel' : 'other',
        region: process.env.VERCEL_REGION || 'unknown'
      }
    };

    const isHealthy = hasOpenAIKey && hasExaKey; // Don't require HelixDB for basic health
    
    return NextResponse.json(status, { 
      status: isHealthy ? 200 : 503 
    });
  } catch (error) {
    console.error('Health check failed:', error);
    
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      services: {
        helixdb: {
          connected: false,
          cacheWarmed: false
        },
        openai: !!process.env.OPENAI_API_KEY ? 'configured' : 'missing_key',
        exa: !!process.env.EXA_API_KEY ? 'configured' : 'missing_key'
      }
    }, { status: 503 });
  }
} 