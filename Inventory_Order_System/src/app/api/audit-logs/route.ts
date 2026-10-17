import { NextRequest } from 'next/server';
import { forwardToBackend } from '@/lib/proxy-helper';

// GET /api/audit-logs - Read audit history via Express backend
export async function GET(request: NextRequest) {
  return forwardToBackend(request, '/api/audit-logs');
}
