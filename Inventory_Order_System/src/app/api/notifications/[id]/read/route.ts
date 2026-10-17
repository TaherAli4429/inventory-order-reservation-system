import { NextRequest } from 'next/server';
import { forwardToBackend } from '@/lib/proxy-helper';

// PATCH /api/notifications/:id/read - Mark notification(s) as read
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return forwardToBackend(request, `/api/notifications/${encodeURIComponent(params.id)}/read`, {
    method: 'PATCH',
  });
}
