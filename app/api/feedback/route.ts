import { NextRequest, NextResponse } from 'next/server';
import { addFeedbackMemory } from '../../lib/supermemory';

export async function POST(request: NextRequest) {
  try {
    const { query, answer, quality, speed, comments, userId } = await request.json();
    if (!query || !answer || !userId) {
      return NextResponse.json({ error: 'Query, answer, and userId are required.' }, { status: 400 });
    }
    await addFeedbackMemory({
      userId,
      content: `Feedback for: ${query}\nAnswer: ${answer}`,
      quality,
      speed,
      comments
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to record feedback.' }, { status: 500 });
  }
} 