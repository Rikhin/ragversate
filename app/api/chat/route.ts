import { NextRequest, NextResponse } from 'next/server';
import { agenticSearchSystem } from '../../lib/agentic-search';
import { multiHelixDB, SearchMode } from '../../lib/multi-helixdb';

export async function POST(request: NextRequest) {
  try {
    const { message, mode } = await request.json();

    if (!message || !mode) {
      return NextResponse.json(
        { error: 'Message and mode are required' },
        { status: 400 }
      );
    }

    // Validate mode
    const validModes: SearchMode[] = ['general', 'summer-programs', 'mentors', 'scholarships'];
    if (!validModes.includes(mode)) {
      return NextResponse.json(
        { error: 'Invalid mode specified' },
        { status: 400 }
      );
    }

    // Use agentic search system for conversational, tool-usage-rich responses
    const agenticResult = await agenticSearchSystem.search(message, `user-chat-${mode}`, mode);

    // Compose a conversational response
    let response = '';
    if (agenticResult.answer) {
      response = agenticResult.answer;
    } else {
      response = `I couldn't find specific information about "${message}" in our ${mode} database yet. Would you like me to search the web or try a different approach?`;
    }

    return NextResponse.json({
      response,
      mode,
      toolUsage: agenticResult.toolUsage,
      performance: agenticResult.performance,
      reasoning: agenticResult.reasoning,
      agentDecisions: agenticResult.agentDecisions,
      evaluation: agenticResult.evaluation,
      source: agenticResult.source,
      cached: agenticResult.cached
    });
  } catch (error) {
    console.error('Error in chat API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 