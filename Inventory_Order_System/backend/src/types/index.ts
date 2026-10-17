export type UserRole = 'admin' | 'staff' | 'viewer';

export interface AuthUser {
  id: string;
  email: string;
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
  quantity_change: number;
  reason: string;
  acting_user: string;
  acting_role: UserRole;
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
  created_at?: string;
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
  status: OrderStatus;
  total_quantity: number;
  total_amount: number;
  created_by: string;
  created_by_role: UserRole;
  idempotency_key?: string;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
  history?: OrderStatusHistory[];
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
  action: string;
  entity_type: string;
  entity_id: string;
  entity_reference: string;
  details: string;
  quantity_change?: number;
  reason?: string;
}

export interface NotificationItem {
  id: string;
  event_id?: string;
  title: string;
  message: string;
  type: 'low_stock' | 'order_status' | 'stock_adjustment' | 'system';
  reference_id?: string;
  reference_type?: string;
  read: boolean;
  created_at: string;
}
