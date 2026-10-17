import { NextRequest, NextResponse } from 'next/server';

export function getBackendBaseUrl(): string {
  return process.env.BACKEND_URL || 'http://localhost:5000';
}

export function extractForwardHeaders(request: NextRequest): Record<string, string> {
  const headers: Record<string, string> = {};

  const auth = request.headers.get('authorization');
  if (auth) headers['authorization'] = auth;

  const email = request.headers.get('x-user-email');
  if (email) headers['x-user-email'] = email;

  const role = request.headers.get('x-user-role');
  if (role) headers['x-user-role'] = role;

  const idempotency = request.headers.get('idempotency-key');
  if (idempotency) headers['idempotency-key'] = idempotency;

  const contentType = request.headers.get('content-type');
  if (contentType) headers['content-type'] = contentType;

  return headers;
}

export async function forwardToBackend(
  request: NextRequest,
  backendPath: string,
  options?: {
    method?: string;
    overrideBody?: any;
    preserveQueryParams?: boolean;
  }
): Promise<NextResponse> {
  const backendBase = getBackendBaseUrl();
  const method = options?.method || request.method;

  let targetUrl = `${backendBase}${backendPath}`;
  if (options?.preserveQueryParams !== false) {
    const { searchParams } = new URL(request.url);
    const qs = searchParams.toString();
    if (qs) {
      targetUrl += (targetUrl.includes('?') ? '&' : '?') + qs;
    }
  }

  const forwardHeaders = extractForwardHeaders(request);

  let body: string | undefined = undefined;
  if (options?.overrideBody !== undefined) {
    body = JSON.stringify(options.overrideBody);
    forwardHeaders['content-type'] = 'application/json';
  } else if (method !== 'GET' && method !== 'HEAD') {
    try {
      const rawBody = await request.json();
      body = JSON.stringify(rawBody);
      forwardHeaders['content-type'] = 'application/json';
    } catch {
      // Body may be empty or not JSON
    }
  }

  try {
    const backendResponse = await fetch(targetUrl, {
      method,
      headers: forwardHeaders,
      body,
      cache: 'no-store',
    });

    const data = await backendResponse.json().catch(() => ({}));
    return NextResponse.json(data, { status: backendResponse.status });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Backend Proxy Error] ${method} ${targetUrl} failed:`, msg);
    return NextResponse.json(
      {
        success: false,
        error: `Express backend service unreachable at ${backendBase}. Ensure the backend server is running on port 5000.`,
      },
      { status: 503 }
    );
  }
}
