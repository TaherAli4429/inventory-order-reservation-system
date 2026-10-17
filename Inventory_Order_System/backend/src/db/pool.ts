import { Pool, PoolClient } from 'pg';
import { env } from '../config/env';
import { Product, Order, StockAdjustment, AuditLog, NotificationItem } from '../types';

let pgPool: Pool | null = null;

function createPoolConfig(rawUrl: string) {
  // Support URLs where raw special characters like @ in password were not percent-encoded
  const atMatches = rawUrl.match(/@/g);
  let connectionString = rawUrl;

  if (atMatches && atMatches.length > 1) {
    const prefix = 'postgresql://';
    if (rawUrl.startsWith(prefix)) {
      const remainder = rawUrl.slice(prefix.length);
      const firstColon = remainder.indexOf(':');
      const lastAt = remainder.lastIndexOf('@');
      if (firstColon !== -1 && lastAt !== -1 && lastAt > firstColon) {
        const user = remainder.slice(0, firstColon);
        const pass = remainder.slice(firstColon + 1, lastAt);
        const hostAndRest = remainder.slice(lastAt + 1);
        connectionString = `${prefix}${encodeURIComponent(decodeURIComponent(user))}:${encodeURIComponent(decodeURIComponent(pass))}@${hostAndRest}`;
      }
    }
  }

  const isRemote = connectionString.includes('supabase') || !connectionString.includes('localhost');
  return {
    connectionString,
    ssl: isRemote ? { rejectUnauthorized: false } : undefined,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 8000,
  };
}

if (env.DATABASE_URL && !env.isTest) {
  pgPool = new Pool(createPoolConfig(env.DATABASE_URL));

  pgPool.on('error', (err) => {
    console.error('[PostgreSQL] Unexpected error on idle client:', err?.message || err);
  });
}

export function getPgPool(): Pool | null {
  if (env.isTest && !process.env.TEST_WITH_LIVE_DB) {
    return null;
  }
  if (!pgPool && env.DATABASE_URL) {
    pgPool = new Pool(createPoolConfig(env.DATABASE_URL));
    pgPool.on('error', (err) => {
      console.error('[PostgreSQL] Unexpected error on idle client:', err?.message || err);
    });
  }
  return pgPool;
}

export async function verifyDatabaseConnection(): Promise<{
  connected: boolean;
  error?: string;
  database?: string;
  serverVersion?: string;
}> {
  const pool = getPgPool();
  if (!pool) {
    return { connected: false, error: 'DATABASE_URL is not configured' };
  }
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT 1 as ok, current_database() as db, version() as ver');
    client.release();
    return {
      connected: true,
      database: result.rows[0]?.db,
      serverVersion: result.rows[0]?.ver,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // Sanitize any potential connection string or credentials from error message
    let sanitized = msg.replace(/:\/\/.*@/, '://***@');
    if (sanitized.includes('ENOTFOUND') && sanitized.includes('.supabase.co')) {
      sanitized += ' (Note: Supabase direct connection host db.[ref].supabase.co is IPv6-only. If your network does not support IPv6, use the Supabase Connection Pooler host: aws-0-[region].pooler.supabase.com:6543)';
    } else if (sanitized.includes('password authentication failed')) {
      sanitized += ' (Note: PostgreSQL rejected the password. Please verify the database password set in Supabase Project Settings -> Database)';
    }
    return { connected: false, error: sanitized };
  }
}

// In-Memory Transactional Engine with Row-Level Mutex Locking for Test & Standalone Execution
class MutexLock {
  private activeLocks = new Set<string>();
  private waitingQueue: Array<() => void> = [];

  async acquire(keys: string[]): Promise<() => void> {
    // Sort keys deterministically to avoid deadlocks (same as ORDER BY id in SQL)
    const sortedKeys = [...keys].sort();

    while (sortedKeys.some((k) => this.activeLocks.has(k))) {
      await new Promise<void>((resolve) => {
        this.waitingQueue.push(resolve);
      });
    }

    for (const key of sortedKeys) {
      this.activeLocks.add(key);
    }

    return () => {
      for (const key of sortedKeys) {
        this.activeLocks.delete(key);
      }
      const next = this.waitingQueue.shift();
      if (next) next();
    };
  }
}

export class MemoryDatabase {
  products: Product[] = [];
  orders: Order[] = [];
  stockAdjustments: StockAdjustment[] = [];
  auditLogs: AuditLog[] = [];
  notifications: NotificationItem[] = [];
  pushTokens: string[] = [];
  idempotencyMap = new Map<string, Order>();
  private rowLock = new MutexLock();

  constructor() {
    this.seed();
  }

  seed() {
    this.products = [
      {
        id: 'prod-001',
        sku: 'LOGI-MXM3S',
        name: 'Logitech MX Master 3S Wireless Mouse',
        unit_price: 99.99,
        available_quantity: 42,
        low_stock_threshold: 10,
        is_active: true,
        created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
        updated_at: new Date(Date.now() - 86400000 * 5).toISOString(),
      },
      {
        id: 'prod-002',
        sku: 'KCHR-Q3PRO',
        name: 'Keychron Q3 Pro Wireless Custom Mechanical Keyboard',
        unit_price: 219.0,
        available_quantity: 4, // Low stock demo (threshold 5)
        low_stock_threshold: 5,
        is_active: true,
        created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
        updated_at: new Date(Date.now() - 86400000 * 1).toISOString(),
      },
      {
        id: 'prod-003',
        sku: 'DELL-U2723QE',
        name: 'Dell UltraSharp 27" 4K USB-C Hub Monitor',
        unit_price: 579.5,
        available_quantity: 14,
        low_stock_threshold: 5,
        is_active: true,
        created_at: new Date(Date.now() - 86400000 * 8).toISOString(),
        updated_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      },
      {
        id: 'prod-004',
        sku: 'CALD-TS4-TB4',
        name: 'CalDigit TS4 Thunderbolt 4 Dock (18 Ports)',
        unit_price: 399.95,
        available_quantity: 2, // Low stock demo (threshold 4)
        low_stock_threshold: 4,
        is_active: true,
        created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
        updated_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      },
      {
        id: 'prod-005',
        sku: 'TEST-CONCURRENCY-5',
        name: 'Concurrency Test Widget (Initial 5 units)',
        unit_price: 50.0,
        available_quantity: 5, // Exactly 5 units for Section 10 concurrency acceptance test
        low_stock_threshold: 2,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    this.orders = [
      {
        id: 'ORD-2026-8801',
        status: 'pending',
        total_quantity: 3,
        total_amount: 349.97,
        created_by: 'staff@enterprise.io',
        created_by_role: 'staff',
        created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
        updated_at: new Date(Date.now() - 3600000 * 2).toISOString(),
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
            product_id: 'prod-002',
            sku: 'KCHR-Q3PRO',
            name: 'Keychron Q3 Pro Wireless Custom Mechanical Keyboard',
            unit_price: 219.0,
            quantity: 1,
            line_total: 219.0,
          },
        ],
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
    ];

    this.stockAdjustments = [
      {
        id: 'adj-001',
        product_id: 'prod-002',
        product_sku: 'KCHR-Q3PRO',
        product_name: 'Keychron Q3 Pro Wireless Custom Mechanical Keyboard',
        quantity_change: -3,
        reason: 'Damaged packaging during warehouse transit; moved to clearance QA',
        acting_user: 'admin@enterprise.io',
        acting_role: 'admin',
        created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      },
    ];

    this.auditLogs = [
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
    ];

    this.notifications = [
      {
        id: 'notif-001',
        event_id: 'low_stock_prod-002_4',
        title: 'Low Stock Alert: Keychron Q3 Pro',
        message: 'Product KCHR-Q3PRO has reached 4 units (Threshold: 5).',
        type: 'low_stock',
        reference_id: 'prod-002',
        reference_type: 'product',
        read: false,
        created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      },
    ];
  }

  // Row-level lock acquisition simulating PostgreSQL SELECT ... FOR UPDATE
  async withRowLocks<T>(productIds: string[], callback: () => Promise<T>): Promise<T> {
    const release = await this.rowLock.acquire(productIds);
    try {
      return await callback();
    } finally {
      release();
    }
  }
}

export const memoryDb = new MemoryDatabase();
