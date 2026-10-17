import { NextRequest } from 'next/server';
import { forwardToBackend } from '@/lib/proxy-helper';

// GET /api/products - Proxy to Express Backend /api/products
export async function GET(request: NextRequest) {
  return forwardToBackend(request, '/api/products');
}

// POST /api/products - Proxy to Express Backend /api/products
export async function POST(request: NextRequest) {
  return forwardToBackend(request, '/api/products', { method: 'POST' });
}
