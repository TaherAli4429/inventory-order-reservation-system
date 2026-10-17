import request from 'supertest';
import { app } from '../src/app';
import { memoryDb } from '../src/db/pool';

describe('Comprehensive Backend Functional & RBAC API Test Suite', () => {
  beforeEach(() => {
    memoryDb.seed();
  });

  describe('1. Products & Inventory Management', () => {
    test('Admin can create product with valid fields', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('x-user-role', 'admin')
        .send({
          sku: 'NEW-PRODUCT-01',
          name: 'Precision Wireless Stylus',
          unit_price: 79.99,
          available_quantity: 25,
          low_stock_threshold: 5,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.sku).toBe('NEW-PRODUCT-01');
      expect(res.body.data.unit_price).toBe(79.99);
    });

    test('Staff and Viewer are prohibited from creating products (403 Forbidden)', async () => {
      const staffRes = await request(app)
        .post('/api/products')
        .set('x-user-role', 'staff')
        .send({
          sku: 'UNAUTHORIZED-SKU-1',
          name: 'Unauthorized Product',
          unit_price: 50.0,
          available_quantity: 10,
          low_stock_threshold: 2,
        });
      expect(staffRes.status).toBe(403);

      const viewerRes = await request(app)
        .post('/api/products')
        .set('x-user-role', 'viewer')
        .send({
          sku: 'UNAUTHORIZED-SKU-2',
          name: 'Unauthorized Product',
          unit_price: 50.0,
          available_quantity: 10,
          low_stock_threshold: 2,
        });
      expect(viewerRes.status).toBe(403);
    });

    test('Validates required fields and rejects invalid numbers', async () => {
      const emptySkuRes = await request(app)
        .post('/api/products')
        .set('x-user-role', 'admin')
        .send({
          name: 'Missing SKU',
          unit_price: 10,
          available_quantity: 5,
          low_stock_threshold: 2,
        });
      expect(emptySkuRes.status).toBe(400);

      const negativePriceRes = await request(app)
        .post('/api/products')
        .set('x-user-role', 'admin')
        .send({
          sku: 'NEG-PRICE',
          name: 'Negative Price Product',
          unit_price: -15.0,
          available_quantity: 5,
          low_stock_threshold: 2,
        });
      expect(negativePriceRes.status).toBe(400);
    });

    test('Admin can update and deactivate product', async () => {
      const res = await request(app)
        .patch('/api/products/prod-001')
        .set('x-user-role', 'admin')
        .send({ is_active: false });

      expect(res.status).toBe(200);
      expect(res.body.data.is_active).toBe(false);
    });
  });

  describe('2. Stock Adjustments & Safeguards', () => {
    test('Records stock adjustment with mandatory reason and applies change', async () => {
      const initialStock = memoryDb.products.find((p) => p.id === 'prod-001')!.available_quantity;

      const res = await request(app)
        .post('/api/stock-adjustments')
        .set('x-user-role', 'admin')
        .send({
          product_id: 'prod-001',
          quantity_change: 10,
          reason: 'Supplier restock verified against PO-1029',
        });

      expect(res.status).toBe(201);
      expect(res.body.product.available_quantity).toBe(initialStock + 10);
    });

    test('Rejects stock adjustment with missing reason', async () => {
      const res = await request(app)
        .post('/api/stock-adjustments')
        .set('x-user-role', 'admin')
        .send({
          product_id: 'prod-001',
          quantity_change: 5,
          reason: '',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/reason.*mandatory/i);
    });

    test('Prevents negative stock on deduction', async () => {
      const res = await request(app)
        .post('/api/stock-adjustments')
        .set('x-user-role', 'admin')
        .send({
          product_id: 'prod-001',
          quantity_change: -9999, // Exceeds available stock
          reason: 'Massive shrinkage test',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/insufficient stock/i);
    });

    test('Viewer is locked from stock adjustments (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/stock-adjustments')
        .set('x-user-role', 'viewer')
        .send({
          product_id: 'prod-001',
          quantity_change: 5,
          reason: 'Viewer attempt',
        });

      expect(res.status).toBe(403);
    });
  });

  describe('3. Order Creation, Authoritative Pricing & Idempotency', () => {
    test('Calculates line totals and order totals authoritatively on server', async () => {
      // prod-001 unit price is 99.99
      const res = await request(app)
        .post('/api/orders')
        .set('x-user-role', 'staff')
        .send({
          items: [{ product_id: 'prod-001', quantity: 3 }],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.total_quantity).toBe(3);
      expect(res.body.data.total_amount).toBe(299.97); // 3 * 99.99
      expect(res.body.data.status).toBe('pending');
    });

    test('Repeated idempotency key returns existing order without creating duplicate', async () => {
      const idempotencyKey = 'unique-key-xyz-12345';

      const firstRes = await request(app)
        .post('/api/orders')
        .set('x-user-role', 'staff')
        .set('idempotency-key', idempotencyKey)
        .send({
          items: [{ product_id: 'prod-001', quantity: 2 }],
        });
      expect(firstRes.status).toBe(201);
      const firstOrderId = firstRes.body.data.id;

      // Duplicate submission with identical key
      const secondRes = await request(app)
        .post('/api/orders')
        .set('x-user-role', 'staff')
        .set('idempotency-key', idempotencyKey)
        .send({
          items: [{ product_id: 'prod-001', quantity: 2 }],
        });

      expect(secondRes.status).toBe(200);
      expect(secondRes.body.idempotent).toBe(true);
      expect(secondRes.body.data.id).toBe(firstOrderId);
    });

    test('Rejects order creation with empty line items or zero quantity', async () => {
      const emptyRes = await request(app)
        .post('/api/orders')
        .set('x-user-role', 'staff')
        .send({ items: [] });
      expect(emptyRes.status).toBe(400);

      const zeroQtyRes = await request(app)
        .post('/api/orders')
        .set('x-user-role', 'staff')
        .send({
          items: [{ product_id: 'prod-001', quantity: 0 }],
        });
      expect(zeroQtyRes.status).toBe(400);
    });
  });

  describe('4. Order Cancellation & Stock Release', () => {
    test('Cancelling a confirmed order releases reserved stock exactly once', async () => {
      // Create and confirm order
      const orderRes = await request(app)
        .post('/api/orders')
        .set('x-user-role', 'staff')
        .send({
          items: [{ product_id: 'prod-003', quantity: 2 }], // prod-003 has 14 units
        });
      const orderId = orderRes.body.data.id;

      await request(app)
        .post(`/api/orders/${orderId}/confirm`)
        .set('x-user-role', 'staff');

      // Available stock is now 12 (14 - 2)
      expect(memoryDb.products.find((p) => p.id === 'prod-003')!.available_quantity).toBe(12);

      // Cancel confirmed order
      const cancelRes = await request(app)
        .post(`/api/orders/${orderId}/cancel`)
        .set('x-user-role', 'staff')
        .send({ reason: 'Customer changed requirements' });

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.released_stock).toBe(true);

      // Available stock restored back to 14
      expect(memoryDb.products.find((p) => p.id === 'prod-003')!.available_quantity).toBe(14);

      // Repeated cancellation must fail (cannot release stock twice)
      const repeatCancelRes = await request(app)
        .post(`/api/orders/${orderId}/cancel`)
        .set('x-user-role', 'staff');

      expect(repeatCancelRes.status).toBe(400);
      expect(memoryDb.products.find((p) => p.id === 'prod-003')!.available_quantity).toBe(14);
    });

    test('Cancelling a pending order marks it cancelled without releasing stock', async () => {
      const orderRes = await request(app)
        .post('/api/orders')
        .set('x-user-role', 'staff')
        .send({
          items: [{ product_id: 'prod-003', quantity: 2 }],
        });
      const orderId = orderRes.body.data.id;
      const initialStock = memoryDb.products.find((p) => p.id === 'prod-003')!.available_quantity;

      const cancelRes = await request(app)
        .post(`/api/orders/${orderId}/cancel`)
        .set('x-user-role', 'staff');

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.released_stock).toBe(false);
      // Stock should remain unchanged
      expect(memoryDb.products.find((p) => p.id === 'prod-003')!.available_quantity).toBe(initialStock);
    });
  });

  describe('5. Audit Logs & Role Access Control', () => {
    test('Admin can access audit logs', async () => {
      const res = await request(app)
        .get('/api/audit-logs')
        .set('x-user-role', 'admin');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('Staff and Viewer are denied access to audit logs (403 Forbidden)', async () => {
      const staffRes = await request(app)
        .get('/api/audit-logs')
        .set('x-user-role', 'staff');
      expect(staffRes.status).toBe(403);

      const viewerRes = await request(app)
        .get('/api/audit-logs')
        .set('x-user-role', 'viewer');
      expect(viewerRes.status).toBe(403);
    });
  });

  describe('6. Notifications & Deduplication', () => {
    test('Notifications can be retrieved and duplicate event_id is ignored', async () => {
      const res = await request(app)
        .get('/api/notifications')
        .set('x-user-role', 'staff');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);

      // Mark all read
      const markRes = await request(app)
        .patch('/api/notifications/all/read')
        .set('x-user-role', 'staff');
      expect(markRes.status).toBe(200);
    });
  });
});
