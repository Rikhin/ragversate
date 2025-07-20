import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();
    
    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Simple query suggestions based on the input
    const suggestions = [
      `Tell me more about ${query}`,
      `What are the benefits of ${query}?`,
      `How does ${query} work?`,
      `What are the applications of ${query}?`,
      `Compare ${query} with alternatives`
    ];

    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json(
      { error: 'Failed to generate suggestions' },
      { status: 500 }
    );
  }
} 