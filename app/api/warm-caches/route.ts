import { NextResponse } from 'next/server';
import { multiHelixDB } from '../../lib/multi-helixdb';

export async function POST() {
  const modes = multiHelixDB.getAvailableModes();
  const results: Record<string, { warmed: boolean; error?: string }> = {};
  let allSuccess = true;

  for (const mode of modes) {
    try {
      await multiHelixDB.connect(mode);
      await multiHelixDB['warmCache'](mode); // Directly warm cache
      results[mode] = { warmed: true };
    } catch (error) {
      results[mode] = { warmed: false, error: error instanceof Error ? error.message : 'Unknown error' };
      allSuccess = false;
    }
  }

  return NextResponse.json({ success: allSuccess, results });
} 