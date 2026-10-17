import { memoryDb, getPgPool } from '../db/pool';
import { StockAdjustment, StockAdjustmentInput, AuthUser } from '../types';
import { AuditLogService } from './auditLog.service';
import { NotificationService } from './notification.service';

export class StockAdjustmentService {
  static async adjustStock(
    input: StockAdjustmentInput,
    actor: AuthUser
  ): Promise<{ adjustment: StockAdjustment; product: { id: string; sku: string; available_quantity: number } }> {
    if (!input.product_id) {
      const err = new Error('Product ID is required');
      (err as any).statusCode = 400;
      throw err;
    }

    const qtyChange = Number(input.quantity_change);
    if (isNaN(qtyChange) || qtyChange === 0) {
      const err = new Error('Quantity change must be a non-zero integer');
      (err as any).statusCode = 400;
      throw err;
    }

    if (!input.reason || !input.reason.trim()) {
      const err = new Error('A valid reason for the stock adjustment is mandatory');
      (err as any).statusCode = 400;
      throw err;
    }

    const pool = getPgPool();

    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Lock target product row
        const prodRes = await client.query(
          'SELECT * FROM public.products WHERE id = $1 FOR UPDATE',
          [input.product_id]
        );

        if (prodRes.rows.length === 0) {
          const err = new Error('Product not found');
          (err as any).statusCode = 404;
          throw err;
        }

        const product = prodRes.rows[0];
        const newQty = product.available_quantity + qtyChange;

        if (newQty < 0) {
          const err = new Error(
            `Insufficient stock for deduction. Available: ${product.available_quantity}, requested reduction: ${Math.abs(qtyChange)}`
          );
          (err as any).statusCode = 400;
          throw err;
        }

        // Apply atomic stock update
        await client.query(
          'UPDATE public.products SET available_quantity = $1, updated_at = NOW() WHERE id = $2',
          [newQty, product.id]
        );

        // Record stock adjustment
        const adjRes = await client.query(
          `INSERT INTO public.stock_adjustments (product_id, product_sku, product_name, acting_user, acting_role, quantity_change, reason)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [
            product.id,
            product.sku,
            product.name,
            actor.email,
            actor.role,
            qtyChange,
            input.reason.trim(),
          ]
        );
        const adjustment = adjRes.rows[0];

        // Record audit log
        await client.query(
          `INSERT INTO public.audit_logs (actor_email, actor_role, action, entity_type, entity_id, entity_reference, details, quantity_change, reason)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            actor.email,
            actor.role,
            'STOCK_ADJUSTMENT',
            'stock',
            product.id,
            product.sku,
            `${qtyChange > 0 ? 'Restocked +' : 'Deducted '}${qtyChange} units (${product.available_quantity} -> ${newQty})`,
            qtyChange,
            input.reason.trim(),
          ]
        );

        await client.query('COMMIT');

        // Low stock trigger
        if (newQty <= product.low_stock_threshold) {
          await NotificationService.createNotification({
            event_id: `low_stock_${product.id}_${newQty}`,
            title: `Low Stock Warning: ${product.name}`,
            message: `Product ${product.sku} has ${newQty} units remaining (Threshold: ${product.low_stock_threshold}).`,
            type: 'low_stock',
            reference_id: product.id,
            reference_type: 'product',
          });
        }

        return {
          adjustment,
          product: {
            id: product.id,
            sku: product.sku,
            available_quantity: newQty,
          },
        };
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    }

    // Memory Store execution with row mutex
    return await memoryDb.withRowLocks([input.product_id], async () => {
      const product = memoryDb.products.find((p) => p.id === input.product_id);
      if (!product) {
        const err = new Error('Product not found');
        (err as any).statusCode = 404;
        throw err;
      }

      const previousQty = product.available_quantity;
      const newQty = previousQty + qtyChange;

      if (newQty < 0) {
        const err = new Error(
          `Insufficient stock for deduction. Available: ${previousQty}, requested reduction: ${Math.abs(qtyChange)}`
        );
        (err as any).statusCode = 400;
        throw err;
      }

      product.available_quantity = newQty;
      product.updated_at = new Date().toISOString();

      const adjustment: StockAdjustment = {
        id: 'adj-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6),
        product_id: product.id,
        product_sku: product.sku,
        product_name: product.name,
        quantity_change: qtyChange,
        reason: input.reason.trim(),
        acting_user: actor.email,
        acting_role: actor.role,
        created_at: new Date().toISOString(),
      };

      memoryDb.stockAdjustments.unshift(adjustment);

      await AuditLogService.record({
        actor_email: actor.email,
        actor_role: actor.role,
        action: 'STOCK_ADJUSTMENT',
        entity_type: 'stock',
        entity_id: product.id,
        entity_reference: product.sku,
        details: `${qtyChange > 0 ? 'Restocked +' : 'Deducted '}${qtyChange} units (${previousQty} -> ${newQty})`,
        quantity_change: qtyChange,
        reason: input.reason.trim(),
      });

      if (newQty <= product.low_stock_threshold) {
        await NotificationService.createNotification({
          event_id: `low_stock_${product.id}_${newQty}`,
          title: `Low Stock Warning: ${product.name}`,
          message: `Product ${product.sku} has ${newQty} units remaining (Threshold: ${product.low_stock_threshold}).`,
          type: 'low_stock',
          reference_id: product.id,
          reference_type: 'product',
        });
      }

      return {
        adjustment,
        product: {
          id: product.id,
          sku: product.sku,
          available_quantity: newQty,
        },
      };
    });
  }

  static async getStockAdjustments(productId?: string): Promise<StockAdjustment[]> {
    const pool = getPgPool();
    if (pool) {
      if (productId) {
        const res = await pool.query(
          'SELECT * FROM public.stock_adjustments WHERE product_id = $1 ORDER BY created_at DESC',
          [productId]
        );
        return res.rows;
      }
      const res = await pool.query(
        'SELECT * FROM public.stock_adjustments ORDER BY created_at DESC LIMIT 50'
      );
      return res.rows;
    }

    if (productId) {
      return memoryDb.stockAdjustments.filter((a) => a.product_id === productId);
    }
    return memoryDb.stockAdjustments;
  }
}
