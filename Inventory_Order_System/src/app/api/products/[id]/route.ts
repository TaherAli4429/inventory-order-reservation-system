import { NextRequest } from 'next/server';
import { forwardToBackend } from '@/lib/proxy-helper';

// GET /api/products/:id - Proxy to Express Backend /api/products/:id
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return forwardToBackend(request, `/api/products/${encodeURIComponent(params.id)}`);
}

// PATCH /api/products/:id - Proxy to Express Backend /api/products/:id
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return forwardToBackend(request, `/api/products/${encodeURIComponent(params.id)}`, {
    method: 'PATCH',
  });
}
