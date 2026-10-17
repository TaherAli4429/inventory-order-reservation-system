import { NextRequest } from 'next/server';
import { forwardToBackend } from '@/lib/proxy-helper';

// GET /api/orders - List orders with pagination and filtering
export async function GET(request: NextRequest) {
  return forwardToBackend(request, '/api/orders');
}

// POST /api/orders - Create order with server-calculated totals and idempotency protection
export async function POST(request: NextRequest) {
  return forwardToBackend(request, '/api/orders', { method: 'POST' });
}
