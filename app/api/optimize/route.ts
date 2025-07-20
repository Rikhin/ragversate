import { NextResponse } from 'next/server';
import { helixDB } from '@/app/lib/helixdb';
import { contextEngine } from '@/app/lib/context-engine';
import { multiHelixDB } from '@/app/lib/multi-helixdb';

export async function POST() {
  const results: Record<string, string> = {};
  let generalOk = false;

  try {
    // 1. Warm HelixDB (general)
    try {
      await helixDB.connect();
      results['general'] = 'cache warmed';
      generalOk = true;
    } catch (err) {
      results['general'] = 'FAILED: ' + (err instanceof Error ? err.message : 'Unknown error');
    }

    // 2. Warm multi-HelixDB (optional modes)
    const optionalModes = ['mentors', 'scholarships', 'summer-programs'] as const;
    for (const mode of optionalModes) {
      try {
        await multiHelixDB.connect(mode);
        results[mode] = 'cache warmed';
      } catch (err) {
        results[mode] = 'SKIPPED: ' + (err instanceof Error ? err.message : 'Not running or no data');
      }
    }

    // 3. Initialize Context Engine
    try {
      if (contextEngine && typeof contextEngine["initializeContextGraph"] === "function") {
        await contextEngine["initializeContextGraph"]();
        results['contextEngine'] = 'initialized';
      }
    } catch (err) {
      results['contextEngine'] = 'FAILED: ' + (err instanceof Error ? err.message : 'Unknown error');
    }

    // 4. Return summary
    if (generalOk) {
      return NextResponse.json({
        status: 'ok',
        message: 'Optimization complete',
        details: results
      });
    } else {
      return NextResponse.json({
        status: 'error',
        message: 'Failed to warm general HelixDB cache',
        details: results
      }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error during optimization',
      details: results
    }, { status: 500 });
  }
} 