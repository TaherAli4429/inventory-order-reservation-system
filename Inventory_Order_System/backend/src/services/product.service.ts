import { memoryDb, getPgPool } from '../db/pool';
import { Product, ProductInput, AuthUser } from '../types';
import { AuditLogService } from './auditLog.service';
import { NotificationService } from './notification.service';

function mapDbProduct(row: any): Product {
  return {
    id: String(row.id),
    sku: String(row.sku),
    name: String(row.name),
    unit_price: Number(row.unit_price),
    available_quantity: Number(row.available_quantity),
    low_stock_threshold: Number(row.low_stock_threshold),
    is_active: Boolean(row.is_active),
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

export class ProductService {
  static async createProduct(input: ProductInput, actor: AuthUser): Promise<Product> {
    if (!input.sku || !input.sku.trim()) {
      const err = new Error('Product SKU is required');
      (err as any).statusCode = 400;
      throw err;
    }
    if (!input.name || !input.name.trim()) {
      const err = new Error('Product name is required');
      (err as any).statusCode = 400;
      throw err;
    }
    if (input.unit_price === undefined || input.unit_price < 0) {
      const err = new Error('Unit price must be a valid non-negative number');
      (err as any).statusCode = 400;
      throw err;
    }
    if (input.available_quantity === undefined || input.available_quantity < 0) {
      const err = new Error('Available quantity must be a non-negative integer');
      (err as any).statusCode = 400;
      throw err;
    }
    if (input.low_stock_threshold === undefined || input.low_stock_threshold < 0) {
      const err = new Error('Low-stock threshold must be a non-negative integer');
      (err as any).statusCode = 400;
      throw err;
    }

    const normalizedSku = input.sku.trim().toUpperCase();
    const pool = getPgPool();

    if (pool) {
      // Check SKU uniqueness
      const existing = await pool.query('SELECT id FROM public.products WHERE UPPER(sku) = $1', [normalizedSku]);
      if (existing.rows.length > 0) {
        const err = new Error(`Product with SKU "${normalizedSku}" already exists`);
        (err as any).statusCode = 409;
        throw err;
      }

      const res = await pool.query(
        `INSERT INTO public.products (sku, name, unit_price, available_quantity, low_stock_threshold, is_active)
         VALUES ($1, $2, $3, $4, $5, true)
         RETURNING *`,
        [normalizedSku, input.name.trim(), input.unit_price, input.available_quantity, input.low_stock_threshold]
      );
      const product = mapDbProduct(res.rows[0]);

      await AuditLogService.record({
        actor_email: actor.email,
        actor_role: actor.role,
        action: 'PRODUCT_CREATED',
        entity_type: 'product',
        entity_id: product.id,
        entity_reference: product.sku,
        details: `Created product "${product.name}" (${product.sku}) with ${product.available_quantity} units at $${Number(product.unit_price).toFixed(2)}`,
        quantity_change: product.available_quantity,
        reason: 'Catalog creation',
      });

      if (product.available_quantity <= product.low_stock_threshold) {
        await NotificationService.createNotification({
          event_id: `low_stock_${product.id}_${product.available_quantity}`,
          title: `Low Stock Warning: ${product.name}`,
          message: `Product ${product.sku} has ${product.available_quantity} units remaining (Threshold: ${product.low_stock_threshold}).`,
          type: 'low_stock',
          reference_id: product.id,
          reference_type: 'product',
        });
      }

      return product;
    }

    // Memory Store execution
    const duplicate = memoryDb.products.find((p) => p.sku.toUpperCase() === normalizedSku);
    if (duplicate) {
      const err = new Error(`Product with SKU "${normalizedSku}" already exists`);
      (err as any).statusCode = 409;
      throw err;
    }

    const newProd: Product = {
      id: 'prod-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6),
      sku: normalizedSku,
      name: input.name.trim(),
      unit_price: Number(input.unit_price),
      available_quantity: Number(input.available_quantity),
      low_stock_threshold: Number(input.low_stock_threshold),
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    memoryDb.products.unshift(newProd);

    await AuditLogService.record({
      actor_email: actor.email,
      actor_role: actor.role,
      action: 'PRODUCT_CREATED',
      entity_type: 'product',
      entity_id: newProd.id,
      entity_reference: newProd.sku,
      details: `Created product "${newProd.name}" (${newProd.sku}) with ${newProd.available_quantity} units at $${newProd.unit_price.toFixed(2)}`,
      quantity_change: newProd.available_quantity,
      reason: 'Catalog creation',
    });

    if (newProd.available_quantity <= newProd.low_stock_threshold) {
      await NotificationService.createNotification({
        event_id: `low_stock_${newProd.id}_${newProd.available_quantity}`,
        title: `Low Stock Warning: ${newProd.name}`,
        message: `Product ${newProd.sku} has ${newProd.available_quantity} units remaining (Threshold: ${newProd.low_stock_threshold}).`,
        type: 'low_stock',
        reference_id: newProd.id,
        reference_type: 'product',
      });
    }

    return newProd;
  }

  static async getProducts(params?: {
    q?: string;
    status?: string;
    low_stock?: boolean;
  }): Promise<Product[]> {
    const pool = getPgPool();
    if (pool) {
      const conditions: string[] = [];
      const values: (string | boolean)[] = [];

      if (params?.status === 'active') {
        conditions.push('is_active = true');
      }
      if (params?.low_stock) {
        conditions.push('available_quantity <= low_stock_threshold');
      }
      if (params?.q) {
        values.push(`%${params.q.toLowerCase()}%`);
        conditions.push(`(LOWER(name) LIKE $${values.length} OR LOWER(sku) LIKE $${values.length})`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const query = `SELECT * FROM public.products ${whereClause} ORDER BY created_at DESC`;
      const res = await pool.query(query, values);
      return res.rows.map(mapDbProduct);
    }

    let products = [...memoryDb.products];
    if (params?.status === 'active') {
      products = products.filter((p) => p.is_active);
    }
    if (params?.low_stock) {
      products = products.filter((p) => p.available_quantity <= p.low_stock_threshold);
    }
    if (params?.q) {
      const q = params.q.toLowerCase();
      products = products.filter(
        (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
      );
    }
    return products;
  }

  static async updateProduct(
    id: string,
    updates: Partial<Product>,
    actor: AuthUser
  ): Promise<Product> {
    const pool = getPgPool();

    if (pool) {
      const currentRes = await pool.query('SELECT * FROM public.products WHERE id = $1', [id]);
      if (currentRes.rows.length === 0) {
        const err = new Error('Product not found');
        (err as any).statusCode = 404;
        throw err;
      }
      const current = currentRes.rows[0];

      if (updates.sku && updates.sku.trim().toUpperCase() !== current.sku.toUpperCase()) {
        const normalizedSku = updates.sku.trim().toUpperCase();
        const dup = await pool.query('SELECT id FROM public.products WHERE UPPER(sku) = $1 AND id != $2', [
          normalizedSku,
          id,
        ]);
        if (dup.rows.length > 0) {
          const err = new Error(`SKU "${normalizedSku}" is already taken by another product`);
          (err as any).statusCode = 409;
          throw err;
        }
        current.sku = normalizedSku;
      }

      if (updates.name) current.name = updates.name.trim();
      if (updates.unit_price !== undefined && updates.unit_price >= 0) current.unit_price = updates.unit_price;
      if (updates.low_stock_threshold !== undefined && updates.low_stock_threshold >= 0) {
        current.low_stock_threshold = updates.low_stock_threshold;
      }
      if (updates.available_quantity !== undefined && updates.available_quantity >= 0) {
        current.available_quantity = updates.available_quantity;
      }
      if (updates.is_active !== undefined) current.is_active = updates.is_active;

      const res = await pool.query(
        `UPDATE public.products
         SET sku = $1, name = $2, unit_price = $3, available_quantity = $4, low_stock_threshold = $5, is_active = $6, updated_at = NOW()
         WHERE id = $7
         RETURNING *`,
        [current.sku, current.name, current.unit_price, current.available_quantity, current.low_stock_threshold, current.is_active, id]
      );
      const updated = mapDbProduct(res.rows[0]);

      await AuditLogService.record({
        actor_email: actor.email,
        actor_role: actor.role,
        action: updates.is_active === false ? 'PRODUCT_DEACTIVATED' : 'PRODUCT_UPDATED',
        entity_type: 'product',
        entity_id: updated.id,
        entity_reference: updated.sku,
        details: updates.is_active === false ? 'Product deactivated' : 'Product details updated',
        reason: updates.is_active === false ? 'Deactivation requested' : 'Product update',
      });

      return updated;
    }

    // Memory Store update
    const index = memoryDb.products.findIndex((p) => p.id === id);
    if (index === -1) {
      const err = new Error('Product not found');
      (err as any).statusCode = 404;
      throw err;
    }

    const current = memoryDb.products[index];
    if (updates.sku && updates.sku.trim().toUpperCase() !== current.sku.toUpperCase()) {
      const normalizedSku = updates.sku.trim().toUpperCase();
      const dup = memoryDb.products.find((p) => p.id !== id && p.sku.toUpperCase() === normalizedSku);
      if (dup) {
        const err = new Error(`SKU "${normalizedSku}" is already taken by another product`);
        (err as any).statusCode = 409;
        throw err;
      }
      current.sku = normalizedSku;
    }

    if (updates.name) current.name = updates.name.trim();
    if (updates.unit_price !== undefined && updates.unit_price >= 0) current.unit_price = Number(updates.unit_price);
    if (updates.low_stock_threshold !== undefined && updates.low_stock_threshold >= 0) {
      current.low_stock_threshold = Number(updates.low_stock_threshold);
    }
    if (updates.available_quantity !== undefined && updates.available_quantity >= 0) {
      current.available_quantity = Number(updates.available_quantity);
    }
    if (updates.is_active !== undefined) current.is_active = updates.is_active;

    current.updated_at = new Date().toISOString();
    memoryDb.products[index] = current;

    await AuditLogService.record({
      actor_email: actor.email,
      actor_role: actor.role,
      action: updates.is_active === false ? 'PRODUCT_DEACTIVATED' : 'PRODUCT_UPDATED',
      entity_type: 'product',
      entity_id: current.id,
      entity_reference: current.sku,
      details: updates.is_active === false ? 'Product deactivated' : 'Product details updated',
      reason: updates.is_active === false ? 'Deactivation requested' : 'Product update',
    });

    return current;
  }

  static async getProductById(id: string): Promise<Product> {
    const pool = getPgPool();
    if (pool) {
      const res = await pool.query('SELECT * FROM public.products WHERE id = $1', [id]);
      if (res.rows.length === 0) {
        const err = new Error('Product not found');
        (err as any).statusCode = 404;
        throw err;
      }
      return mapDbProduct(res.rows[0]);
    }
    const found = memoryDb.products.find((p) => p.id === id);
    if (!found) {
      const err = new Error('Product not found');
      (err as any).statusCode = 404;
      throw err;
    }
    return found;
  }
}
