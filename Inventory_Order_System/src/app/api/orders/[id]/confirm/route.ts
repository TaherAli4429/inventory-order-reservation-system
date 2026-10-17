import { NextRequest } from 'next/server';
import { forwardToBackend } from '@/lib/proxy-helper';

// POST /api/orders/:id/confirm - Atomically reserve stock and confirm order via Express backend
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return forwardToBackend(request, `/api/orders/${encodeURIComponent(params.id)}/confirm`, {
    method: 'POST',
  });
}
