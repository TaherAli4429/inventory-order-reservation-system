import { NextRequest } from 'next/server';
import { forwardToBackend } from '@/lib/proxy-helper';

// POST /api/notifications/fcm-token - Register FCM push token
export async function POST(request: NextRequest) {
  return forwardToBackend(request, '/api/notifications/fcm-token', { method: 'POST' });
}
