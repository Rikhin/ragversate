import { NextResponse } from 'next/server';
import { logger } from '@/app/lib/logging';

export async function GET() {
  const metrics = logger.getMetrics();
  return NextResponse.json(metrics);
} 