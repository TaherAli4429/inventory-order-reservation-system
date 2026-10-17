import { NextRequest } from 'next/server';
import { forwardToBackend } from '@/lib/proxy-helper';

// GET /api/orders/:id - Fetch single order details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return forwardToBackend(request, `/api/orders/${encodeURIComponent(params.id)}`);
}
