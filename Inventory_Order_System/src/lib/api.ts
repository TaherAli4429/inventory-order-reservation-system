import {
  Product,
  ProductInput,
  StockAdjustment,
  StockAdjustmentInput,
  Order,
  CreateOrderInput,
  AuditLog,
  NotificationItem,
  PaginatedResponse,
  ApiResponse,
} from '@/types';

// Storage key for client-side demo active user session
const AUTH_STORAGE_KEY = 'ios_user_session';

export function getActiveUserSession(): { email: string; role: string; token?: string } {
  if (typeof window === 'undefined') {
    return { email: 'admin@enterprise.io', role: 'admin' };
  }
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return { email: 'admin@enterprise.io', role: 'admin' };
}

// Base request wrapper that attaches user identity headers
async function request<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const session = getActiveUserSession();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  headers.set('x-user-email', session.email);
  headers.set('x-user-role', session.role);
  if (session.token) {
    headers.set('Authorization', `Bearer ${session.token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMessage = data?.error || data?.message || `Request failed with status ${response.status}`;
    const error = new Error(errorMessage) as Error & { status?: number; data?: unknown };
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

// Centralized Typed API Client
export const api = {
  // Products
  async getProducts(params?: {
    q?: string;
    status?: string;
    low_stock?: boolean;
  }): Promise<{ success: boolean; data: Product[]; total: number }> {
    const searchParams = new URLSearchParams();
    if (params?.q) searchParams.set('q', params.q);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.low_stock) searchParams.set('low_stock', 'true');
    const qs = searchParams.toString();
    return request<{ success: boolean; data: Product[]; total: number }>(
      `/api/products${qs ? `?${qs}` : ''}`
    );
  },

  async createProduct(input: ProductInput): Promise<{ success: boolean; data: Product }> {
    return request<{ success: boolean; data: Product }>('/api/products', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async updateProduct(
    id: string,
    updates: Partial<Product>
  ): Promise<{ success: boolean; data: Product }> {
    return request<{ success: boolean; data: Product }>(`/api/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  async deactivateProduct(id: string): Promise<{ success: boolean; data: Product }> {
    return request<{ success: boolean; data: Product }>(`/api/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: false }),
    });
  },

  // Stock Adjustments
  async createStockAdjustment(
    input: StockAdjustmentInput
  ): Promise<{ success: boolean; data: StockAdjustment; product: { id: string; sku: string; available_quantity: number } }> {
    return request<{
      success: boolean;
      data: StockAdjustment;
      product: { id: string; sku: string; available_quantity: number };
    }>('/api/stock-adjustments', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async getStockAdjustments(productId?: string): Promise<{ success: boolean; data: StockAdjustment[]; total: number }> {
    const qs = productId ? `?product_id=${encodeURIComponent(productId)}` : '';
    return request<{ success: boolean; data: StockAdjustment[]; total: number }>(
      `/api/stock-adjustments${qs}`
    );
  },

  // Orders
  async getOrders(params?: {
    page?: number;
    limit?: number;
    status?: string;
    q?: string;
  }): Promise<PaginatedResponse<Order>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.status) searchParams.set('status', params.status);
    if (params?.q) searchParams.set('q', params.q);
    const qs = searchParams.toString();
    return request<PaginatedResponse<Order>>(`/api/orders${qs ? `?${qs}` : ''}`);
  },

  async getOrderById(id: string): Promise<{ success: boolean; data: Order }> {
    return request<{ success: boolean; data: Order }>(`/api/orders/${id}`);
  },

  async createOrder(
    input: CreateOrderInput
  ): Promise<{ success: boolean; data: Order; idempotent?: boolean; message?: string }> {
    const headers: Record<string, string> = {};
    if (input.idempotency_key) {
      headers['idempotency-key'] = input.idempotency_key;
    }

    return request<{ success: boolean; data: Order; idempotent?: boolean; message?: string }>(
      '/api/orders',
      {
        method: 'POST',
        headers,
        body: JSON.stringify(input),
      }
    );
  },

  async confirmOrder(id: string): Promise<{ success: boolean; data: Order; message: string }> {
    return request<{ success: boolean; data: Order; message: string }>(
      `/api/orders/${id}/confirm`,
      {
        method: 'POST',
      }
    );
  },

  async cancelOrder(
    id: string,
    reason?: string
  ): Promise<{ success: boolean; data: Order; released_stock: boolean; message: string }> {
    return request<{ success: boolean; data: Order; released_stock: boolean; message: string }>(
      `/api/orders/${id}/cancel`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: reason || 'Cancelled by user' }),
      }
    );
  },

  // Audit Logs
  async getAuditLogs(params?: {
    action?: string;
    entity_type?: string;
    q?: string;
  }): Promise<{ success: boolean; data: AuditLog[]; total: number }> {
    const searchParams = new URLSearchParams();
    if (params?.action) searchParams.set('action', params.action);
    if (params?.entity_type) searchParams.set('entity_type', params.entity_type);
    if (params?.q) searchParams.set('q', params.q);
    const qs = searchParams.toString();
    return request<{ success: boolean; data: AuditLog[]; total: number }>(
      `/api/audit-logs${qs ? `?${qs}` : ''}`
    );
  },

  // Notifications
  async getNotifications(
    unreadOnly?: boolean
  ): Promise<{ success: boolean; data: NotificationItem[]; unread_count: number; total: number }> {
    const qs = unreadOnly ? '?unread=true' : '';
    return request<{
      success: boolean;
      data: NotificationItem[];
      unread_count: number;
      total: number;
    }>(`/api/notifications${qs}`);
  },

  async markNotificationRead(id: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/api/notifications/${id}/read`, {
      method: 'PATCH',
    });
  },

  async markAllNotificationsRead(): Promise<{ success: boolean }> {
    return request<{ success: boolean }>('/api/notifications/all/read', {
      method: 'PATCH',
    });
  },

  async registerFcmToken(token: string): Promise<{ success: boolean; message: string }> {
    return request<{ success: boolean; message: string }>('/api/notifications/fcm-token', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },
};
