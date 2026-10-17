export type UserRole = 'admin' | 'staff' | 'viewer';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  unit_price: number;
  available_quantity: number;
  low_stock_threshold: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductInput {
  sku: string;
  name: string;
  unit_price: number;
  available_quantity: number;
  low_stock_threshold: number;
}

export interface StockAdjustment {
  id: string;
  product_id: string;
  product_sku: string;
  product_name: string;
  quantity_change: number; // positive for addition, negative for reduction
  reason: string;
  actor_email: string;
  actor_role: UserRole;
  created_at: string;
}

export interface StockAdjustmentInput {
  product_id: string;
  quantity_change: number;
  reason: string;
}

export type OrderStatus = 'pending' | 'confirmed' | 'fulfilled' | 'cancelled';

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  sku: string;
  name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}

export interface OrderItemInput {
  product_id: string;
  quantity: number;
}

export interface OrderStatusHistory {
  id: string;
  order_id: string;
  previous_status: OrderStatus | null;
  new_status: OrderStatus;
  actor_email: string;
  actor_role: UserRole;
  timestamp: string;
  note?: string;
}

export interface Order {
  id: string;
  items: OrderItem[];
  total_quantity: number;
  total_amount: number;
  status: OrderStatus;
  created_by: string;
  created_by_role: UserRole;
  created_at: string;
  updated_at: string;
  history?: OrderStatusHistory[];
  idempotency_key?: string;
}

export interface CreateOrderInput {
  items: OrderItemInput[];
  idempotency_key?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actor_email: string;
  actor_role: UserRole;
  action:
    | 'PRODUCT_CREATED'
    | 'PRODUCT_UPDATED'
    | 'PRODUCT_DEACTIVATED'
    | 'STOCK_ADJUSTMENT'
    | 'ORDER_CREATED'
    | 'ORDER_CONFIRMED'
    | 'ORDER_CANCELLED'
    | 'ORDER_FULFILLED';
  entity_type: 'product' | 'stock' | 'order';
  entity_id: string;
  entity_reference: string; // SKU or Order ID
  details: string;
  quantity_change?: number;
  reason?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'low_stock' | 'order_status' | 'stock_adjustment' | 'system';
  timestamp: string;
  read: boolean;
  reference_id?: string;
  reference_type?: 'product' | 'order';
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
