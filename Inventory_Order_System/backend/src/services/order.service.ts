import { memoryDb, getPgPool } from '../db/pool';
import { Order, OrderItem, CreateOrderInput, AuthUser, OrderStatus } from '../types';
import { AuditLogService } from './auditLog.service';
import { NotificationService } from './notification.service';

export class OrderService {
  static async createOrder(
    input: CreateOrderInput,
    actor: AuthUser
  ): Promise<{ order: Order; idempotent?: boolean }> {
    if (!input.items || !Array.isArray(input.items) || input.items.length === 0) {
      const err = new Error('At least one product line item is required to create an order');
      (err as any).statusCode = 400;
      throw err;
    }

    const pool = getPgPool();
    const idempotencyKey = input.idempotency_key?.trim() || undefined;

    // Idempotency verification
    if (idempotencyKey) {
      if (pool) {
        const existingRes = await pool.query(
          'SELECT * FROM public.orders WHERE idempotency_key = $1',
          [idempotencyKey]
        );
        if (existingRes.rows.length > 0) {
          const existingOrder = existingRes.rows[0];
          const itemsRes = await pool.query(
            'SELECT * FROM public.order_items WHERE order_id = $1',
            [existingOrder.id]
          );
          existingOrder.items = itemsRes.rows;
          return { order: existingOrder, idempotent: true };
        }
      } else {
        if (memoryDb.idempotencyMap.has(idempotencyKey)) {
          return { order: memoryDb.idempotencyMap.get(idempotencyKey)!, idempotent: true };
        }
      }
    }

    // Server-Authoritative calculation
    const orderId = `ORD-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const lineItems: OrderItem[] = [];
    let totalQuantity = 0;
    let totalAmount = 0;

    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        for (const itemInput of input.items) {
          const qty = Math.floor(Number(itemInput.quantity));
          if (isNaN(qty) || qty <= 0) {
            const err = new Error('Product quantities must be positive whole numbers');
            (err as any).statusCode = 400;
            throw err;
          }

          const prodRes = await client.query('SELECT * FROM public.products WHERE id = $1', [itemInput.product_id]);
          if (prodRes.rows.length === 0) {
            const err = new Error(`Product ID "${itemInput.product_id}" was not found`);
            (err as any).statusCode = 400;
            throw err;
          }

          const product = prodRes.rows[0];
          if (!product.is_active) {
            const err = new Error(`Product "${product.name}" (${product.sku}) is deactivated and cannot be ordered`);
            (err as any).statusCode = 400;
            throw err;
          }

          // Authoritative line calculation
          const unitPrice = Number(product.unit_price);
          const lineTotal = Number((unitPrice * qty).toFixed(2));
          totalQuantity += qty;
          totalAmount = Number((totalAmount + lineTotal).toFixed(2));

          lineItems.push({
            id: 'item-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6),
            order_id: orderId,
            product_id: product.id,
            sku: product.sku,
            name: product.name,
            unit_price: unitPrice,
            quantity: qty,
            line_total: lineTotal,
          });
        }

        // Insert Order
        const orderRes = await client.query(
          `INSERT INTO public.orders (id, status, total_quantity, total_amount, created_by, created_by_role, idempotency_key)
           VALUES ($1, 'pending', $2, $3, $4, $5, $6)
           RETURNING *`,
          [orderId, totalQuantity, totalAmount, actor.email, actor.role, idempotencyKey || null]
        );
        const order = orderRes.rows[0];

        // Insert Line items
        for (const item of lineItems) {
          const itemRes = await client.query(
            `INSERT INTO public.order_items (order_id, product_id, sku, name, unit_price, quantity, line_total)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [item.order_id, item.product_id, item.sku, item.name, item.unit_price, item.quantity, item.line_total]
          );
          if (itemRes.rows[0]) {
            item.id = String(itemRes.rows[0].id);
          }
        }

        // Insert Order History
        await client.query(
          `INSERT INTO public.order_status_history (order_id, previous_status, new_status, actor_email, actor_role, note)
           VALUES ($1, NULL, 'pending', $2, $3, $4)`,
          [orderId, actor.email, actor.role, `Order created with ${lineItems.length} line items (Pending stock reservation)`]
        );

        // Record Audit log
        await client.query(
          `INSERT INTO public.audit_logs (actor_email, actor_role, action, entity_type, entity_id, entity_reference, details, reason)
           VALUES ($1, $2, 'ORDER_CREATED', 'order', $3, $4, $5, 'New order requisition')`,
          [
            actor.email,
            actor.role,
            orderId,
            orderId,
            `Created order with ${totalQuantity} units across ${lineItems.length} items (Total: $${totalAmount.toFixed(2)})`,
          ]
        );

        await client.query('COMMIT');
        order.items = lineItems;
        return { order };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    // Memory Store execution
    for (const itemInput of input.items) {
      const qty = Math.floor(Number(itemInput.quantity));
      if (isNaN(qty) || qty <= 0) {
        const err = new Error('Product quantities must be positive whole numbers');
        (err as any).statusCode = 400;
        throw err;
      }

      const product = memoryDb.products.find((p) => p.id === itemInput.product_id);
      if (!product) {
        const err = new Error(`Product ID "${itemInput.product_id}" was not found`);
        (err as any).statusCode = 400;
        throw err;
      }

      if (!product.is_active) {
        const err = new Error(`Product "${product.name}" (${product.sku}) is deactivated and cannot be ordered`);
        (err as any).statusCode = 400;
        throw err;
      }

      const lineTotal = Number((product.unit_price * qty).toFixed(2));
      totalQuantity += qty;
      totalAmount = Number((totalAmount + lineTotal).toFixed(2));

      lineItems.push({
        id: 'item-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6),
        order_id: orderId,
        product_id: product.id,
        sku: product.sku,
        name: product.name,
        unit_price: product.unit_price,
        quantity: qty,
        line_total: lineTotal,
      });
    }

    const newOrder: Order = {
      id: orderId,
      status: 'pending',
      total_quantity: totalQuantity,
      total_amount: totalAmount,
      created_by: actor.email,
      created_by_role: actor.role,
      idempotency_key: idempotencyKey,
      items: lineItems,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      history: [
        {
          id: 'hist-' + Date.now().toString(36),
          order_id: orderId,
          previous_status: null,
          new_status: 'pending',
          actor_email: actor.email,
          actor_role: actor.role,
          timestamp: new Date().toISOString(),
          note: `Order created with ${lineItems.length} items (Pending stock reservation)`,
        },
      ],
    };

    memoryDb.orders.unshift(newOrder);
    if (idempotencyKey) {
      memoryDb.idempotencyMap.set(idempotencyKey, newOrder);
    }

    await AuditLogService.record({
      actor_email: actor.email,
      actor_role: actor.role,
      action: 'ORDER_CREATED',
      entity_type: 'order',
      entity_id: newOrder.id,
      entity_reference: newOrder.id,
      details: `Created order with ${totalQuantity} units across ${lineItems.length} items (Authoritative total: $${totalAmount.toFixed(2)})`,
      reason: 'New order requisition',
    });

    return { order: newOrder };
  }

  // CRITICAL CONCURRENCY-SAFE CONFIRMATION METHOD
  static async confirmOrder(orderId: string, actor: AuthUser): Promise<Order> {
    const pool = getPgPool();

    if (pool) {
      // Execute PostgreSQL stored function with row-level locks
      try {
        const res = await pool.query(
          'SELECT public.confirm_order_atomic($1, $2, $3) as result',
          [orderId, actor.email, actor.role]
        );
        return await this.getOrderById(orderId);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('INSUFFICIENT_STOCK')) {
          const e = new Error(msg);
          (e as any).statusCode = 409; // 409 Conflict for concurrent stock shortage
          throw e;
        }
        if (msg.includes('ORDER_ALREADY_CONFIRMED') || msg.includes('INVALID_ORDER_STATE')) {
          const e = new Error(msg);
          (e as any).statusCode = 400;
          throw e;
        }
        throw err;
      }
    }

    // Memory Store Execution with genuine row mutex locking
    const order = memoryDb.orders.find((o) => o.id === orderId);
    if (!order) {
      const err = new Error('Order not found');
      (err as any).statusCode = 404;
      throw err;
    }

    if (order.status === 'confirmed') {
      const err = new Error('Order is already confirmed');
      (err as any).statusCode = 400;
      throw err;
    }

    if (order.status === 'fulfilled' || order.status === 'cancelled') {
      const err = new Error(`Cannot confirm an order in "${order.status}" status`);
      (err as any).statusCode = 400;
      throw err;
    }

    const productIds = order.items?.map((i) => i.product_id) || [];

    return await memoryDb.withRowLocks(productIds, async () => {
      // 1. All-or-Nothing Stock Verification
      const shortages: string[] = [];
      for (const item of order.items || []) {
        const prod = memoryDb.products.find((p) => p.id === item.product_id);
        if (!prod) {
          shortages.push(`Product "${item.name}" not found`);
        } else if (prod.available_quantity < item.quantity) {
          shortages.push(
            `Product "${prod.name}" (${prod.sku}) has only ${prod.available_quantity} available, but ${item.quantity} requested`
          );
        }
      }

      if (shortages.length > 0) {
        const err = new Error(`INSUFFICIENT_STOCK: ${shortages.join('. ')}`);
        (err as any).statusCode = 409;
        throw err;
      }

      // 2. Atomic Stock Deduction
      const reservedDetails: string[] = [];
      for (const item of order.items || []) {
        const prod = memoryDb.products.find((p) => p.id === item.product_id)!;
        prod.available_quantity -= item.quantity;
        prod.updated_at = new Date().toISOString();
        reservedDetails.push(`${item.quantity}x ${prod.sku}`);

        // Trigger low-stock notification if threshold met
        if (prod.available_quantity <= prod.low_stock_threshold) {
          await NotificationService.createNotification({
            event_id: `low_stock_${prod.id}_${prod.available_quantity}`,
            title: `Low Stock Warning: ${prod.name}`,
            message: `Product ${prod.sku} has ${prod.available_quantity} units remaining (Threshold: ${prod.low_stock_threshold}).`,
            type: 'low_stock',
            reference_id: prod.id,
            reference_type: 'product',
          });
        }
      }

      // 3. Update Order Status
      const prevStatus = order.status;
      order.status = 'confirmed';
      order.updated_at = new Date().toISOString();

      if (!order.history) order.history = [];
      order.history.unshift({
        id: 'hist-' + Date.now().toString(36),
        order_id: order.id,
        previous_status: prevStatus,
        new_status: 'confirmed',
        actor_email: actor.email,
        actor_role: actor.role,
        timestamp: new Date().toISOString(),
        note: `Stock atomically reserved: ${reservedDetails.join('; ')}`,
      });

      await AuditLogService.record({
        actor_email: actor.email,
        actor_role: actor.role,
        action: 'ORDER_CONFIRMED',
        entity_type: 'order',
        entity_id: order.id,
        entity_reference: order.id,
        details: `Confirmed order and reserved stock: ${reservedDetails.join('; ')}`,
        reason: 'Order confirmed by authorized staff',
      });

      await NotificationService.createNotification({
        event_id: `order_confirmed_${order.id}`,
        title: `Order Confirmed: ${order.id}`,
        message: `Order ${order.id} was confirmed and stock reserved by ${actor.email}.`,
        type: 'order_status',
        reference_id: order.id,
        reference_type: 'order',
      });

      return order;
    });
  }

  // EXACT-ONCE CANCELLATION METHOD
  static async cancelOrder(
    orderId: string,
    actor: AuthUser,
    reason = 'Order cancelled by user'
  ): Promise<{ order: Order; released_stock: boolean }> {
    const pool = getPgPool();

    if (pool) {
      try {
        const res = await pool.query(
          'SELECT public.cancel_order_atomic($1, $2, $3, $4) as result',
          [orderId, actor.email, actor.role, reason]
        );
        const order = await this.getOrderById(orderId);
        return { order, released_stock: Boolean(res.rows[0]?.result?.released_stock) };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('ORDER_ALREADY_CANCELLED') || msg.includes('CANNOT_CANCEL_FULFILLED')) {
          const e = new Error(msg);
          (e as any).statusCode = 400;
          throw e;
        }
        throw err;
      }
    }

    // Memory Store Execution
    const order = memoryDb.orders.find((o) => o.id === orderId);
    if (!order) {
      const err = new Error('Order not found');
      (err as any).statusCode = 404;
      throw err;
    }

    if (order.status === 'cancelled') {
      const err = new Error('Order has already been cancelled');
      (err as any).statusCode = 400;
      throw err;
    }

    if (order.status === 'fulfilled') {
      const err = new Error('Fulfilled orders cannot be cancelled');
      (err as any).statusCode = 400;
      throw err;
    }

    const previousStatus = order.status;
    let releasedStock = false;
    const releasedDetails: string[] = [];

    // CRITICAL: Only restore stock IF the order was in 'confirmed' status
    if (previousStatus === 'confirmed') {
      releasedStock = true;
      for (const item of order.items || []) {
        const prod = memoryDb.products.find((p) => p.id === item.product_id);
        if (prod) {
          prod.available_quantity += item.quantity;
          prod.updated_at = new Date().toISOString();
          releasedDetails.push(`${item.quantity}x ${prod.sku}`);
        }
      }
    }

    order.status = 'cancelled';
    order.updated_at = new Date().toISOString();

    if (!order.history) order.history = [];
    order.history.unshift({
      id: 'hist-' + Date.now().toString(36),
      order_id: order.id,
      previous_status: previousStatus,
      new_status: 'cancelled',
      actor_email: actor.email,
      actor_role: actor.role,
      timestamp: new Date().toISOString(),
      note: releasedStock
        ? `Order cancelled and reserved stock restored: ${releasedDetails.join('; ')}. Reason: ${reason}`
        : `Order cancelled from pending status (No stock was reserved). Reason: ${reason}`,
    });

    await AuditLogService.record({
      actor_email: actor.email,
      actor_role: actor.role,
      action: 'ORDER_CANCELLED',
      entity_type: 'order',
      entity_id: order.id,
      entity_reference: order.id,
      details: releasedStock
        ? `Cancelled confirmed order and restored stock: ${releasedDetails.join('; ')}`
        : 'Cancelled pending order',
      reason,
    });

    await NotificationService.createNotification({
      event_id: `order_cancelled_${order.id}`,
      title: `Order Cancelled: ${order.id}`,
      message: `Order ${order.id} was cancelled by ${actor.email}.${releasedStock ? ' Reserved stock released.' : ''}`,
      type: 'order_status',
      reference_id: order.id,
      reference_type: 'order',
    });

    return { order, released_stock: releasedStock };
  }

  static async getOrders(params?: {
    page?: number;
    limit?: number;
    status?: string;
    q?: string;
  }): Promise<{ orders: Order[]; total: number; page: number; limit: number; total_pages: number }> {
    const page = Math.max(1, params?.page || 1);
    const limit = Math.max(1, Math.min(50, params?.limit || 10));
    const pool = getPgPool();

    if (pool) {
      const conditions: string[] = [];
      const values: (string | number)[] = [];

      if (params?.status && params.status !== 'all') {
        values.push(params.status);
        conditions.push(`status = $${values.length}`);
      }
      if (params?.q) {
        values.push(`%${params.q.toLowerCase()}%`);
        conditions.push(`(LOWER(id) LIKE $${values.length} OR LOWER(created_by) LIKE $${values.length})`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const countRes = await pool.query(`SELECT COUNT(*) FROM public.orders ${whereClause}`, values);
      const total = parseInt(countRes.rows[0].count, 10);
      const total_pages = Math.ceil(total / limit) || 1;

      values.push(limit);
      const limitParamIndex = values.length;
      values.push((page - 1) * limit);
      const offsetParamIndex = values.length;

      const ordersRes = await pool.query(
        `SELECT * FROM public.orders ${whereClause} ORDER BY created_at DESC LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`,
        values
      );

      const orders = ordersRes.rows;
      for (const order of orders) {
        const itemsRes = await pool.query('SELECT * FROM public.order_items WHERE order_id = $1', [order.id]);
        order.items = itemsRes.rows;
      }

      return { orders, total, page, limit, total_pages };
    }

    let orders = [...memoryDb.orders];
    if (params?.status && params.status !== 'all') {
      orders = orders.filter((o) => o.status === params.status);
    }
    if (params?.q) {
      const q = params.q.toLowerCase();
      orders = orders.filter(
        (o) =>
          o.id.toLowerCase().includes(q) ||
          o.created_by.toLowerCase().includes(q) ||
          o.items?.some((i) => i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q))
      );
    }

    const total = orders.length;
    const total_pages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedOrders = orders.slice(startIndex, startIndex + limit);

    return { orders: paginatedOrders, total, page, limit, total_pages };
  }

  static async getOrderById(orderId: string): Promise<Order> {
    const pool = getPgPool();
    if (pool) {
      const orderRes = await pool.query('SELECT * FROM public.orders WHERE id = $1', [orderId]);
      if (orderRes.rows.length === 0) {
        const err = new Error('Order not found');
        (err as any).statusCode = 404;
        throw err;
      }
      const order = orderRes.rows[0];
      const itemsRes = await pool.query('SELECT * FROM public.order_items WHERE order_id = $1', [orderId]);
      const histRes = await pool.query(
        'SELECT * FROM public.order_status_history WHERE order_id = $1 ORDER BY created_at DESC',
        [orderId]
      );
      order.items = itemsRes.rows;
      order.history = histRes.rows;
      return order;
    }

    const order = memoryDb.orders.find((o) => o.id === orderId);
    if (!order) {
      const err = new Error('Order not found');
      (err as any).statusCode = 404;
      throw err;
    }
    return order;
  }
}
