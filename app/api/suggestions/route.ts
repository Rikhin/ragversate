import { NextRequest, NextResponse } from 'next/server';
import { getSuggestions, getPopularEntitiesStats } from '@/app/lib/prefetch-popular-entities';
import { logApiCall, logInfo } from '@/app/lib/logging';

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '5');
    
    if (!query || query.length < 2) {
      return NextResponse.json({ suggestions: [] });
    }

    // Get suggestions from popular entities
    const suggestions = getSuggestions(query).slice(0, limit);
    
    // Get stats for monitoring
    const stats = getPopularEntitiesStats();
    
    logInfo('Query suggestions generated', { 
      query, 
      suggestionsCount: suggestions.length,
      stats 
    });

    const duration = Date.now() - startTime;
    logApiCall('/api/suggestions', duration, true);

    return NextResponse.json({
      suggestions,
      query,
      total: suggestions.length,
      stats
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logApiCall('/api/suggestions', duration, false);
    
    console.error('Error generating suggestions:', error);
    return NextResponse.json(
      { error: 'Failed to generate suggestions' },
      { status: 500 }
    );
  }
} 