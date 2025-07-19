import { NextRequest, NextResponse } from 'next/server';
import { helixDB } from '@/app/lib/helixdb';

export async function GET(req: NextRequest) {
  try {
    // Check HelixDB connection
    const helixStatus = await helixDB.healthCheck();
    
    // Check environment variables
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
    const hasExaKey = !!process.env.EXA_API_KEY;
    
    const status = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        helixdb: helixStatus ? 'connected' : 'disconnected',
        openai: hasOpenAIKey ? 'configured' : 'missing_key',
        exa: hasExaKey ? 'configured' : 'missing_key'
      },
      environment: process.env.NODE_ENV || 'development'
    };

    const isHealthy = helixStatus && hasOpenAIKey && hasExaKey;
    
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
        helixdb: 'error',
        openai: !!process.env.OPENAI_API_KEY ? 'configured' : 'missing_key',
        exa: !!process.env.EXA_API_KEY ? 'configured' : 'missing_key'
      }
    }, { status: 503 });
  }
} 