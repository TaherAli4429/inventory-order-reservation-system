import {
  Product,
  StockAdjustment,
  Order,
  AuditLog,
  NotificationItem,
  UserRole,
  OrderStatus,
  OrderItemInput,
} from '@/types';

// In-memory persistent singleton for server execution across API routes
interface ServerDatabase {
  products: Product[];
  stockAdjustments: StockAdjustment[];
  orders: Order[];
  auditLogs: AuditLog[];
  notifications: NotificationItem[];
  idempotencyKeys: Map<string, Order>;
}

declare global {
  // eslint-disable-next-line no-var
  var __SERVER_DB__: ServerDatabase | undefined;
}

function initDefaultDatabase(): ServerDatabase {
  const initialProducts: Product[] = [
    {
      id: 'prod-001',
      sku: 'LOGI-MXM3S',
      name: 'Logitech MX Master 3S Wireless Mouse',
      unit_price: 99.99,
      available_quantity: 42,
      low_stock_threshold: 10,
      is_active: true,
      created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 10).toISOString(),
    },
    {
      id: 'prod-002',
      sku: 'KCHR-Q3PRO',
      name: 'Keychron Q3 Pro Wireless Custom Mechanical Keyboard',
      unit_price: 219.00,
      available_quantity: 4, // Intentionally low stock (<= threshold 5) for instant demo
      low_stock_threshold: 5,
      is_active: true,
      created_at: new Date(Date.now() - 86400000 * 8).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      id: 'prod-003',
      sku: 'DELL-U2723QE',
      name: 'Dell UltraSharp 27" 4K USB-C Hub Monitor',
      unit_price: 579.50,
      available_quantity: 14,
      low_stock_threshold: 5,
      is_active: true,
      created_at: new Date(Date.now() - 86400000 * 15).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 1).toISOString(),
    },
    {
      id: 'prod-004',
      sku: 'CALD-TS4-TB4',
      name: 'CalDigit TS4 Thunderbolt 4 Dock (18 Ports)',
      unit_price: 399.95,
      available_quantity: 2, // Low stock (<= threshold 4)
      low_stock_threshold: 4,
      is_active: true,
      created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 1).toISOString(),
    },
    {
      id: 'prod-005',
      sku: 'ANKR-737-PB',
      name: 'Anker 737 Power Bank (PowerCore 24K, 140W)',
      unit_price: 149.99,
      available_quantity: 28,
      low_stock_threshold: 8,
      is_active: true,
      created_at: new Date(Date.now() - 86400000 * 12).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 12).toISOString(),
    },
    {
      id: 'prod-006',
      sku: 'APPL-MBA-M3',
      name: 'Apple MacBook Air 15" M3 (16GB RAM, 512GB SSD)',
      unit_price: 1499.00,
      available_quantity: 8,
      low_stock_threshold: 3,
      is_active: true,
      created_at: new Date(Date.now() - 86400000 * 20).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 4).toISOString(),
    },
    {
      id: 'prod-007',
      sku: 'SONY-WH1000XM5',
      name: 'Sony WH-1000XM5 Wireless Noise-Cancelling Headphones',
      unit_price: 398.00,
      available_quantity: 0, // Out of stock
      low_stock_threshold: 5,
      is_active: true,
      created_at: new Date(Date.now() - 86400000 * 25).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 1).toISOString(),
    },
    {
      id: 'prod-008',
      sku: 'SAM-T7-2TB',
      name: 'Samsung T7 Shield 2TB Portable Rugged SSD',
      unit_price: 189.99,
      available_quantity: 19,
      low_stock_threshold: 6,
      is_active: false, // Inactive product demonstration
      created_at: new Date(Date.now() - 86400000 * 30).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 6).toISOString(),
    },
  ];

  const initialOrders: Order[] = [
    {
      id: 'ORD-2026-8801',
      items: [
        {
          id: 'item-8801-1',
          order_id: 'ORD-2026-8801',
          product_id: 'prod-001',
          sku: 'LOGI-MXM3S',
          name: 'Logitech MX Master 3S Wireless Mouse',
          unit_price: 99.99,
          quantity: 2,
          line_total: 199.98,
        },
        {
          id: 'item-8801-2',
          order_id: 'ORD-2026-8801',
          product_id: 'prod-005',
          sku: 'ANKR-737-PB',
          name: 'Anker 737 Power Bank (PowerCore 24K, 140W)',
          unit_price: 149.99,
          quantity: 1,
          line_total: 149.99,
        },
      ],
      total_quantity: 3,
      total_amount: 349.97,
      status: 'pending',
      created_by: 'staff@enterprise.io',
      created_by_role: 'staff',
      created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      history: [
        {
          id: 'hist-8801-1',
          order_id: 'ORD-2026-8801',
          previous_status: null,
          new_status: 'pending',
          actor_email: 'staff@enterprise.io',
          actor_role: 'staff',
          timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
          note: 'Order submitted with 2 items pending stock reservation',
        },
      ],
    },
    {
      id: 'ORD-2026-8799',
      items: [
        {
          id: 'item-8799-1',
          order_id: 'ORD-2026-8799',
          product_id: 'prod-003',
          sku: 'DELL-U2723QE',
          name: 'Dell UltraSharp 27" 4K USB-C Hub Monitor',
          unit_price: 579.50,
          quantity: 2,
          line_total: 1159.00,
        },
      ],
      total_quantity: 2,
      total_amount: 1159.00,
      status: 'confirmed',
      created_by: 'admin@enterprise.io',
      created_by_role: 'admin',
      created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 6).toISOString(),
      history: [
        {
          id: 'hist-8799-1',
          order_id: 'ORD-2026-8799',
          previous_status: null,
          new_status: 'pending',
          actor_email: 'admin@enterprise.io',
          actor_role: 'admin',
          timestamp: new Date(Date.now() - 86400000 * 1).toISOString(),
          note: 'Initial order creation',
        },
        {
          id: 'hist-8799-2',
          order_id: 'ORD-2026-8799',
          previous_status: 'pending',
          new_status: 'confirmed',
          actor_email: 'admin@enterprise.io',
          actor_role: 'admin',
          timestamp: new Date(Date.now() - 3600000 * 6).toISOString(),
          note: 'Stock atomically reserved (2 units DELL-U2723QE)',
        },
      ],
    },
    {
      id: 'ORD-2026-8790',
      items: [
        {
          id: 'item-8790-1',
          order_id: 'ORD-2026-8790',
          product_id: 'prod-006',
          sku: 'APPL-MBA-M3',
          name: 'Apple MacBook Air 15" M3 (16GB RAM, 512GB SSD)',
          unit_price: 1499.00,
          quantity: 1,
          line_total: 1499.00,
        },
      ],
      total_quantity: 1,
      total_amount: 1499.00,
      status: 'fulfilled',
      created_by: 'staff@enterprise.io',
      created_by_role: 'staff',
      created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      history: [
        {
          id: 'hist-8790-1',
          order_id: 'ORD-2026-8790',
          previous_status: null,
          new_status: 'pending',
          actor_email: 'staff@enterprise.io',
          actor_role: 'staff',
          timestamp: new Date(Date.now() - 86400000 * 3).toISOString(),
          note: 'Order submitted',
        },
        {
          id: 'hist-8790-2',
          order_id: 'ORD-2026-8790',
          previous_status: 'pending',
          new_status: 'confirmed',
          actor_email: 'admin@enterprise.io',
          actor_role: 'admin',
          timestamp: new Date(Date.now() - 86400000 * 3 + 1800000).toISOString(),
          note: 'Stock reserved',
        },
        {
          id: 'hist-8790-3',
          order_id: 'ORD-2026-8790',
          previous_status: 'confirmed',
          new_status: 'fulfilled',
          actor_email: 'admin@enterprise.io',
          actor_role: 'admin',
          timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
          note: 'Order dispatched and fulfilled to recipient',
        },
      ],
    },
    {
      id: 'ORD-2026-8785',
      items: [
        {
          id: 'item-8785-1',
          order_id: 'ORD-2026-8785',
          product_id: 'prod-004',
          sku: 'CALD-TS4-TB4',
          name: 'CalDigit TS4 Thunderbolt 4 Dock (18 Ports)',
          unit_price: 399.95,
          quantity: 1,
          line_total: 399.95,
        },
      ],
      total_quantity: 1,
      total_amount: 399.95,
      status: 'cancelled',
      created_by: 'staff@enterprise.io',
      created_by_role: 'staff',
      created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      history: [
        {
          id: 'hist-8785-1',
          order_id: 'ORD-2026-8785',
          previous_status: null,
          new_status: 'pending',
          actor_email: 'staff@enterprise.io',
          actor_role: 'staff',
          timestamp: new Date(Date.now() - 86400000 * 4).toISOString(),
          note: 'Order submitted',
        },
        {
          id: 'hist-8785-2',
          order_id: 'ORD-2026-8785',
          previous_status: 'pending',
          new_status: 'cancelled',
          actor_email: 'admin@enterprise.io',
          actor_role: 'admin',
          timestamp: new Date(Date.now() - 86400000 * 3).toISOString(),
          note: 'Cancelled by customer request before confirmation',
        },
      ],
    },
  ];

  const initialStockAdjustments: StockAdjustment[] = [
    {
      id: 'adj-001',
      product_id: 'prod-002',
      product_sku: 'KCHR-Q3PRO',
      product_name: 'Keychron Q3 Pro Wireless Custom Mechanical Keyboard',
      quantity_change: -3,
      reason: 'Damaged packaging during warehouse transit; moved to clearance QA',
      actor_email: 'admin@enterprise.io',
      actor_role: 'admin',
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      id: 'adj-002',
      product_id: 'prod-001',
      product_sku: 'LOGI-MXM3S',
      product_name: 'Logitech MX Master 3S Wireless Mouse',
      quantity_change: 15,
      reason: 'Supplier restock shipment received and verified via PO-9912',
      actor_email: 'admin@enterprise.io',
      actor_role: 'admin',
      created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    },
  ];

  const initialAuditLogs: AuditLog[] = [
    {
      id: 'audit-001',
      timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
      actor_email: 'admin@enterprise.io',
      actor_role: 'admin',
      action: 'STOCK_ADJUSTMENT',
      entity_type: 'stock',
      entity_id: 'prod-002',
      entity_reference: 'KCHR-Q3PRO',
      details: 'Decreased stock by 3 units (Available now: 4)',
      quantity_change: -3,
      reason: 'Damaged packaging during warehouse transit; moved to clearance QA',
    },
    {
      id: 'audit-002',
      timestamp: new Date(Date.now() - 86400000 * 3).toISOString(),
      actor_email: 'admin@enterprise.io',
      actor_role: 'admin',
      action: 'STOCK_ADJUSTMENT',
      entity_type: 'stock',
      entity_id: 'prod-001',
      entity_reference: 'LOGI-MXM3S',
      details: 'Increased stock by 15 units (Available now: 42)',
      quantity_change: 15,
      reason: 'Supplier restock shipment received and verified via PO-9912',
    },
    {
      id: 'audit-003',
      timestamp: new Date(Date.now() - 3600000 * 6).toISOString(),
      actor_email: 'admin@enterprise.io',
      actor_role: 'admin',
      action: 'ORDER_CONFIRMED',
      entity_type: 'order',
      entity_id: 'ORD-2026-8799',
      entity_reference: 'ORD-2026-8799',
      details: 'Atomically reserved 2 units of DELL-U2723QE and confirmed order',
      reason: 'Order confirmed with atomic stock reservation',
    },
    {
      id: 'audit-004',
      timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
      actor_email: 'staff@enterprise.io',
      actor_role: 'staff',
      action: 'ORDER_CREATED',
      entity_type: 'order',
      entity_id: 'ORD-2026-8801',
      entity_reference: 'ORD-2026-8801',
      details: 'Created order with 2 line items, authoritative total $349.97',
      reason: 'New client requisition submitted',
    },
  ];

  const initialNotifications: NotificationItem[] = [
    {
      id: 'notif-001',
      title: 'Low Stock Alert: Keychron Q3 Pro',
      message: 'Product KCHR-Q3PRO has reached 4 units (Threshold: 5). Reorder recommended.',
      type: 'low_stock',
      timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
      read: false,
      reference_id: 'prod-002',
      reference_type: 'product',
    },
    {
      id: 'notif-002',
      title: 'Low Stock Alert: CalDigit TS4 Dock',
      message: 'Product CALD-TS4-TB4 has 2 units remaining (Threshold: 4). Critical stock level.',
      type: 'low_stock',
      timestamp: new Date(Date.now() - 86400000 * 1).toISOString(),
      read: false,
      reference_id: 'prod-004',
      reference_type: 'product',
    },
    {
      id: 'notif-003',
      title: 'Order Confirmed: ORD-2026-8799',
      message: 'Order ORD-2026-8799 was confirmed and stock successfully reserved by Admin.',
      type: 'order_status',
      timestamp: new Date(Date.now() - 3600000 * 6).toISOString(),
      read: true,
      reference_id: 'ORD-2026-8799',
      reference_type: 'order',
    },
  ];

  return {
    products: initialProducts,
    stockAdjustments: initialStockAdjustments,
    orders: initialOrders,
    auditLogs: initialAuditLogs,
    notifications: initialNotifications,
    idempotencyKeys: new Map<string, Order>(),
  };
}

// Global singleton getter
export function getServerDatabase(): ServerDatabase {
  if (!global.__SERVER_DB__) {
    global.__SERVER_DB__ = initDefaultDatabase();
  }
  return global.__SERVER_DB__;
}

// Low-stock check helper
export function checkAndTriggerLowStock(
  product: Product,
  db: ServerDatabase
) {
  if (product.available_quantity <= product.low_stock_threshold) {
    const isCritical = product.available_quantity === 0;
    const notif: NotificationItem = {
      id: 'notif-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6),
      title: `${isCritical ? 'Out of Stock' : 'Low Stock Warning'}: ${product.name}`,
      message: `Product ${product.sku} has ${product.available_quantity} units left (Threshold: ${product.low_stock_threshold}).`,
      type: 'low_stock',
      timestamp: new Date().toISOString(),
      read: false,
      reference_id: product.id,
      reference_type: 'product',
    };
    db.notifications.unshift(notif);
  }
}

// Audit logger helper
export function recordAuditLog(
  db: ServerDatabase,
  entry: Omit<AuditLog, 'id' | 'timestamp'>
) {
  const log: AuditLog = {
    ...entry,
    id: 'audit-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 7),
    timestamp: new Date().toISOString(),
  };
  db.auditLogs.unshift(log);
  return log;
}
