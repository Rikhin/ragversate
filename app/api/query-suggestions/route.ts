import { NextRequest, NextResponse } from 'next/server';
import { optimizedSupermemoryService } from '@/app/lib/supermemory-optimized';

export async function POST(req: NextRequest) {
  try {
    const { query, userId, limit = 5 } = await req.json();

    if (!query || !userId) {
      return NextResponse.json(
        { error: 'Query and userId are required' },
        { status: 400 }
      );
    }

    console.log(`🔍 Getting personalized suggestions for user ${userId} on query: "${query}"`);

    // Initialize optimized supermemory service
    await optimizedSupermemoryService.initialize();
    
    // Get comprehensive suggestions from Optimized Supermemory
    const [personalizedSuggestions, userContext] = await Promise.all([
      optimizedSupermemoryService.getPersonalizedSuggestions(userId, query),
      optimizedSupermemoryService.getUserContext(userId)
    ]);

    // Generate follow-up questions based on user patterns
    const followUpQuestions = await optimizedSupermemoryService.generateFollowUpQuestions(userId, query, '');

    return NextResponse.json({
      personalizedSuggestions,
      followUpQuestions: followUpQuestions.slice(0, 3),
      userContext: {
        currentTopics: userContext.currentTopics.slice(0, 3),
        recentEntities: userContext.recentEntities.slice(0, 2),
        sentiment: userContext.sentiment,
        complexity: userContext.complexity
      },
      query,
      userId,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('❌ Query suggestions error:', error);
    return NextResponse.json(
      { error: 'Failed to get query suggestions' },
      { status: 500 }
    );
  }
} 