import { NextRequest, NextResponse } from 'next/server';

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

    // Simple search response for now
    console.log(`\n🚀 [AGENT] Starting search for: "${query}"`);
    console.log(`📊 [AGENT] User ID: ${userId}`);
    console.log('='.repeat(50));

    // Generate a simple response
    const response = {
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