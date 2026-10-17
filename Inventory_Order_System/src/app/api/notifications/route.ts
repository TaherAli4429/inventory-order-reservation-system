import { NextRequest } from 'next/server';
import { forwardToBackend } from '@/lib/proxy-helper';

// GET /api/notifications - List in-app notifications
export async function GET(request: NextRequest) {
  return forwardToBackend(request, '/api/notifications');
}

// POST /api/notifications - Register FCM push token fallback
export async function POST(request: NextRequest) {
  return forwardToBackend(request, '/api/notifications/fcm-token', { method: 'POST' });
}
