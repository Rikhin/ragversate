import { NextRequest, NextResponse } from 'next/server';
import { supermemoryService } from '@/app/lib/supermemory';

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

    // Get comprehensive suggestions from Supermemory
    const [suggestions, personalizedSuggestions, userContext] = await Promise.all([
      supermemoryService.getQuerySuggestions(userId, query, limit),
      supermemoryService.getPersonalizedSuggestions(userId, query),
      supermemoryService.getUserContext(userId)
    ]);

    // Generate follow-up questions based on user patterns
    const followUpQuestions = await supermemoryService.generateFollowUpQuestions(userId, query, '');

    // Get user insights for better personalization
    const userInsights = await supermemoryService.getUserInsights(userId);

    return NextResponse.json({
      suggestions,
      personalizedSuggestions,
      followUpQuestions: followUpQuestions.slice(0, 3),
      userContext: {
        recentQueries: userContext.recentQueries.slice(0, 3),
        preferredCategories: userContext.preferredCategories.slice(0, 3),
        queryPatterns: userContext.queryPatterns.slice(0, 2)
      },
      userInsights: {
        favoriteTopics: userInsights.favoriteTopics.slice(0, 3),
        searchFrequency: userInsights.searchFrequency,
        knowledgeGaps: userInsights.knowledgeGaps.slice(0, 2)
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