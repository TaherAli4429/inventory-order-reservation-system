import { NextRequest } from 'next/server';
import { forwardToBackend } from '@/lib/proxy-helper';

// GET /api/stock-adjustments - List stock adjustment history
export async function GET(request: NextRequest) {
  return forwardToBackend(request, '/api/stock-adjustments');
}

// POST /api/stock-adjustments - Record a reasoned stock adjustment
export async function POST(request: NextRequest) {
  return forwardToBackend(request, '/api/stock-adjustments', { method: 'POST' });
}
