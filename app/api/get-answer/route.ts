import { NextRequest, NextResponse } from 'next/server';
import { agenticSearchSystem } from '@/app/lib/agentic-search';
import { semanticCache } from '@/app/lib/semantic-cache';
import { logger } from '@/app/lib/logging';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(2, 10);
  
  try {
    const body = await request.json();
    const { query, userId, stream = false } = body;

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Log the request
    logger.log('info', 'API Call: /api/get-answer', {
      requestId,
      query,
      userId,
      stream
    });

    // Check semantic cache first (non-streaming)
    if (!stream) {
      const cachedResult = await semanticCache.getCachedResponse(query, userId);
      if (cachedResult) {
        logger.log('info', 'Semantic Cache Hit: api_response', {
          requestId,
          similarity: cachedResult.similarity,
          originalQuery: cachedResult.query
        });
        
        return NextResponse.json({
          answer: cachedResult.answer,
          source: cachedResult.source,
          cached: true,
          performance: cachedResult.performance,
          reasoning: cachedResult.reasoning,
          toolUsage: cachedResult.toolUsage,
          agentDecisions: cachedResult.agentDecisions,
          similarity: cachedResult.similarity,
          originalQuery: cachedResult.query,
          entities: typeof cachedResult === 'object' && cachedResult && 'entities' in cachedResult ? (cachedResult as { entities: unknown[] }).entities : [],
          summary: typeof cachedResult === 'object' && cachedResult && 'summary' in cachedResult ? (cachedResult as { summary: string }).summary : ''
        });
      }

      logger.log('info', 'Cache Miss: api_response', { requestId });
    }

    // Perform agentic search
    const result = await agenticSearchSystem.search(query, userId || 'anonymous');

    // Cache the result (non-streaming)
    if (!stream) {
      await semanticCache.cacheResponse(query, userId, result);
    }

    const totalTime = Date.now() - startTime;

    // Log the response
    logger.log('info', 'API Call: /api/get-answer', {
      duration: totalTime,
      success: true,
      requestId
    });

    return NextResponse.json({
      ...result,
      entities: typeof result === 'object' && result && 'entities' in result ? (result as { entities: unknown[] }).entities : [],
      summary: typeof result === 'object' && result && 'summary' in result ? (result as { summary: string }).summary : '',
      requestId
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;
    
    logger.log('error', 'API Call: /api/get-answer', {
      duration: totalTime,
      success: false,
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      { error: 'Internal server error', requestId },
      { status: 500 }
    );
  }
} 