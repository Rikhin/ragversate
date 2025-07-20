const { NextRequest, NextResponse } = require('next/server');
const { agentSearch } = require('@/app/lib/agent-search');
const { logger } = require('@/app/lib/logging');
const { optimizedSupermemoryService } = require('@/app/lib/supermemory-optimized');
const { userSessionManager } = require('@/app/lib/user-session');

// Simple caching for API responses
const responseCache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 300000; // 5 minutes

function hashInput(input: unknown): string {
  return JSON.stringify(input);
}

function getCachedResponse(query: string, userId?: string): unknown | null {
  const key = hashInput({ query, userId });
  const cached = responseCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

function cacheResponse(query: string, userId: string | undefined, data: unknown): void {
  const key = hashInput({ query, userId });
  responseCache.set(key, { data, timestamp: Date.now() });
}

export async function GET(request: NextRequest) {
  return NextResponse.json({ error: 'GET method not supported. Use POST.' }, { status: 405 });
}

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(2, 10);
  const startTime = Date.now();

  try {
    // Check if required environment variables are available
    const requiredEnvVars = ['OPENAI_API_KEY', 'EXA_API_KEY'];
    const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
    
    if (missingEnvVars.length > 0) {
      console.error('Missing environment variables:', missingEnvVars);
      return NextResponse.json({ 
        error: 'Server configuration error - missing environment variables',
        missingVars: missingEnvVars,
        requestId 
      }, { status: 500 });
    }

    const { query, userId: providedUserId } = await request.json();

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Use provided userId or generate one from session
    const userId = providedUserId || userSessionManager.getUserIdFromRequest(request);

    logger.log('info', 'API Call: /api/get-answer', {
      requestId,
      query,
      userId
    });

    // Check cache first
    const cachedResponse = getCachedResponse(query, userId);
    if (cachedResponse) {
      logger.log('info', 'Cache Hit: api_response', { requestId });
      return NextResponse.json(cachedResponse);
    }

    logger.log('info', 'Cache Miss: api_response', { requestId });

    // Get user context for personalization
    let userContextAvailable = false;
    try {
      const context = await optimizedSupermemoryService.getUserContext(userId);
      userContextAvailable = !!context;
    } catch (error) {
      logger.log('warn', 'Failed to get user context', { error: (error as Error).message });
    }

    // Get personalized suggestions
    let personalizedSuggestionsCount = 0;
    try {
      const suggestions = await optimizedSupermemoryService.getPersonalizedSuggestions(query, userId);
      personalizedSuggestionsCount = suggestions.length;
    } catch (error) {
      logger.log('warn', 'Failed to get personalized suggestions', { error: (error as Error).message });
    }

    // Search user knowledge
    let userKnowledgeAvailable = false;
    try {
      const knowledge = await optimizedSupermemoryService.searchUserKnowledge(query, userId);
      userKnowledgeAvailable = !!knowledge;
    } catch (error) {
      logger.log('warn', 'Failed to search user knowledge', { error: (error as Error).message });
    }

    // Execute agent search
    console.log(`\n🚀 [AGENT] Starting search for: "${query}"`);
    console.log(`📊 [AGENT] User ID: ${userId}`);
    console.log(`🧠 [AGENT] User Context: ${userContextAvailable ? 'Available' : 'None'}`);
    console.log(`💡 [AGENT] Personalized Suggestions: ${personalizedSuggestionsCount} found`);
    console.log(`📚 [AGENT] User Knowledge: ${userKnowledgeAvailable ? 'Available' : 'None'}`);
    console.log('='.repeat(50));

    let searchResult;
    try {
      searchResult = await agentSearch(query, userId);
    } catch (searchError) {
      console.error('Agent search failed:', searchError);
      return NextResponse.json({
        error: 'Search service temporarily unavailable',
        details: process.env.NODE_ENV === 'development' ? (searchError as Error).message : 'Please try again later',
        requestId
      }, { status: 503 });
    }

    // Log tool usage summary
    console.log('\n📊 [AGENT] Tool Usage Summary:');
    searchResult.toolUsage.forEach((usage, index) => {
      const status = usage.success ? '✅' : '❌';
      console.log(`${index + 1}. ${status} ${usage.tool}.${usage.action} (${usage.duration}ms)`);
    });

    console.log(`\n🎯 [AGENT] Final Result:`);
    console.log(`   Source: ${searchResult.source}`);
    console.log(`   Cached: ${searchResult.cached}`);
    console.log(`   Total Time: ${searchResult.performance.totalTime}ms`);
    console.log(`   Reasoning: ${searchResult.reasoning}`);
    console.log('='.repeat(50));

    // Generate follow-up questions
    const followUpQuestions = [
      "What specific aspect would you like to know more about?",
      "Would you like me to search for related information?",
      "Is there anything else you'd like to explore on this topic?"
    ];

    const response = {
      answer: searchResult.answer,
      source: searchResult.source,
      cached: searchResult.cached,
      performance: searchResult.performance,
      reasoning: searchResult.reasoning,
      toolUsage: searchResult.toolUsage,
      followUpQuestions,
      requestId
    };

    // Cache the response
    cacheResponse(query, userId, response);

    const duration = Date.now() - startTime;
    logger.log('info', 'API Call: /api/get-answer', { duration, success: true, requestId });

    return NextResponse.json(response);

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.log('error', 'API Call: /api/get-answer', { duration, success: false, requestId, error: (error as Error).message });
    
    return NextResponse.json(
      { error: 'Failed to process query', requestId },
      { status: 500 }
    );
  }
} 