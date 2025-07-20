import { NextRequest, NextResponse } from 'next/server';
import { contextEngine } from '@/app/lib/context-engine';
import { logger } from '@/app/lib/logging';

export async function POST(request: NextRequest) {
  try {
    const { query, userId, action } = await request.json();

    if (!query || !userId) {
      return NextResponse.json({ error: 'Query and userId are required' }, { status: 400 });
    }

    switch (action) {
      case 'analyze':
        const context = await contextEngine.analyzeContext(query, userId);
        return NextResponse.json({
          success: true,
          context: {
            currentTopics: context.currentTopics,
            relatedEntities: context.relatedEntities,
            queryIntent: context.queryIntent,
            likelyNextQueries: context.likelyNextQueries,
            suggestedExpansions: context.suggestedExpansions
          }
        });

      case 'reactive':
        const reactiveResponse = await contextEngine.generateReactiveResponse(query, userId);
        return NextResponse.json({
          success: true,
          response: reactiveResponse
        });

      case 'summary':
        const summary = contextEngine.getContextSummary(userId);
        return NextResponse.json({
          success: true,
          summary
        });

      default:
        return NextResponse.json({ error: 'Invalid action. Use: analyze, reactive, or summary' }, { status: 400 });
    }

  } catch (error) {
    logger.log('error', 'Context API error', { error: (error as Error).message });
    return NextResponse.json(
      { error: 'Failed to process context request' },
      { status: 500 }
    );
  }
} 