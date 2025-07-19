import { NextRequest, NextResponse } from 'next/server';

// Conditional import to avoid ES module issues
let agentSearch: ((query: string, userId: string) => Promise<{
  answer: string;
  source: string;
  cached: boolean;
  performance: { helixdbTime: number; exaTime: number; totalTime: number };
  reasoning: string;
  toolUsage: Array<{
    tool: string;
    action: string;
    parameters: Record<string, unknown>;
    startTime: number;
    endTime: number;
    duration: number;
    success: boolean;
    result?: unknown;
    error?: string;
  }>;
}>) | null = null;

// Try to import the agent search function
try {
  // Use dynamic import to avoid build-time issues
  agentSearch = async (query: string, userId: string) => {
    const { agentSearch: searchFn } = await import('../../lib/agent-search');
    return searchFn(query, userId);
  };
} catch (error) {
  console.warn('Agent search module not available, using fallback');
}

// Simple caching for API responses (temporarily disabled)

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

    // Use provided userId or generate a simple one
    const userId = providedUserId || 'user-' + Math.random().toString(36).substring(2, 10);

    console.log('API Call: /api/get-answer', {
      requestId,
      query,
      userId
    });

    // Execute agent search if available, otherwise use simplified response
    console.log(`\n🚀 [AGENT] Starting search for: "${query}"`);
    console.log(`📊 [AGENT] User ID: ${userId}`);
    console.log('='.repeat(50));

    let searchResult;
    let response;

    if (agentSearch) {
      try {
        searchResult = await agentSearch(query, userId);
        
        // Log tool usage summary
        console.log('\n📊 [AGENT] Tool Usage Summary:');
        searchResult.toolUsage.forEach((usage: {
          tool: string;
          action: string;
          duration: number;
          success: boolean;
        }, index: number) => {
          const status = usage.success ? '✅' : '❌';
          console.log(`${index + 1}. ${status} ${usage.tool}.${usage.action} (${usage.duration}ms)`);
        });

        console.log(`\n🎯 [AGENT] Final Result:`);
        console.log(`   Source: ${searchResult.source}`);
        console.log(`   Cached: ${searchResult.cached}`);
        console.log(`   Total Time: ${searchResult.performance.totalTime}ms`);
        console.log(`   Reasoning: ${searchResult.reasoning}`);
        console.log('='.repeat(50));

        response = {
          answer: searchResult.answer,
          source: searchResult.source,
          cached: searchResult.cached,
          performance: searchResult.performance,
          reasoning: searchResult.reasoning,
          toolUsage: searchResult.toolUsage,
          followUpQuestions: [
            "What specific aspect would you like to know more about?",
            "Would you like me to search for related information?",
            "Is there anything else you'd like to explore on this topic?"
          ],
          requestId
        };
      } catch (searchError) {
        console.error('Agent search failed:', searchError);
        // Fall back to simplified response
        response = {
          answer: `I found information about "${query}". This is a simplified response while we restore full functionality.`,
          source: 'simplified' as const,
          cached: false,
          performance: { helixdbTime: 0, exaTime: 0, totalTime: Date.now() - startTime },
          reasoning: 'Simplified search mode - full functionality being restored',
          toolUsage: [],
          followUpQuestions: [
            "What specific aspect would you like to know more about?",
            "Would you like me to search for related information?",
            "Is there anything else you'd like to explore on this topic?"
          ],
          requestId
        };
      }
    } else {
      // Simplified response when agent search is not available
      response = {
        answer: `I found information about "${query}". This is a simplified response while we restore full functionality.`,
        source: 'simplified' as const,
        cached: false,
        performance: { helixdbTime: 0, exaTime: 0, totalTime: Date.now() - startTime },
        reasoning: 'Simplified search mode - full functionality being restored',
        toolUsage: [],
        followUpQuestions: [
          "What specific aspect would you like to know more about?",
          "Would you like me to search for related information?",
          "Is there anything else you'd like to explore on this topic?"
        ],
        requestId
      };
    }

    const duration = Date.now() - startTime;
    console.log('API Call: /api/get-answer', { duration, success: true, requestId });

    return NextResponse.json(response);

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('API Call: /api/get-answer', { duration, success: false, requestId, error: (error as Error).message });
    
    return NextResponse.json(
      { error: 'Failed to process query', requestId },
      { status: 500 }
    );
  }
} 