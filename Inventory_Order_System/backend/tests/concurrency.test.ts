import request from 'supertest';
import { app } from '../src/app';
import { memoryDb } from '../src/db/pool';

describe('Critical Concurrency & Overselling Prevention Test Suite', () => {
  beforeEach(() => {
    // Reset database state before each test
    memoryDb.seed();
  });

  /**
   * MANDATORY ACCEPTANCE TEST FROM ASSIGNMENT SPECIFICATION (Section 2 & 10):
   * "If a product has 5 units left, submit two concurrent orders requesting 4 units each.
   * At most one order may reserve 4 units; stock must never become negative,
   * and the second order must fail or remain unconfirmed."
   */
  test('Section 10 Acceptance Test: Two concurrent orders requesting 4 units when only 5 units exist', async () => {
    // 1. Create a clean test product with exactly 5 units available
    const productRes = await request(app)
      .post('/api/products')
      .set('x-user-role', 'admin')
      .set('x-user-email', 'admin@enterprise.io')
      .send({
        sku: 'TEST-CONCURRENCY-ACCEPTANCE',
        name: 'Concurrency Acceptance Test Product',
        unit_price: 100.0,
        available_quantity: 5,
        low_stock_threshold: 2,
      });

    expect(productRes.status).toBe(201);
    const productId = productRes.body.data.id;
    expect(productRes.body.data.available_quantity).toBe(5);

    // 2. Create Order A requesting 4 units
    const orderARes = await request(app)
      .post('/api/orders')
      .set('x-user-role', 'staff')
      .set('x-user-email', 'staff-a@enterprise.io')
      .send({
        items: [{ product_id: productId, quantity: 4 }],
        idempotency_key: 'idemp-order-a-' + Date.now(),
      });
    expect(orderARes.status).toBe(201);
    const orderAId = orderARes.body.data.id;

    // 3. Create Order B requesting 4 units
    const orderBRes = await request(app)
      .post('/api/orders')
      .set('x-user-role', 'staff')
      .set('x-user-email', 'staff-b@enterprise.io')
      .send({
        items: [{ product_id: productId, quantity: 4 }],
        idempotency_key: 'idemp-order-b-' + Date.now(),
      });
    expect(orderBRes.status).toBe(201);
    const orderBId = orderBRes.body.data.id;

    // 4. SUBMIT CONCURRENT CONFIRMATION REQUESTS AT THE EXACT SAME TIME
    const [confirmResA, confirmResB] = await Promise.all([
      request(app)
        .post(`/api/orders/${orderAId}/confirm`)
        .set('x-user-role', 'staff')
        .set('x-user-email', 'staff-a@enterprise.io'),
      request(app)
        .post(`/api/orders/${orderBId}/confirm`)
        .set('x-user-role', 'staff')
        .set('x-user-email', 'staff-b@enterprise.io'),
    ]);

    const results = [confirmResA, confirmResB];
    const successes = results.filter((r) => r.status === 200);
    const failures = results.filter((r) => r.status === 409);

    // VERIFICATION OF SPECIFICATION REQUIREMENTS:
    // a) At most one order is confirmed
    expect(successes.length).toBe(1);
    expect(successes[0].body.data.status).toBe('confirmed');

    // b) The other order fails with 409 Conflict
    expect(failures.length).toBe(1);
    expect(failures[0].body.error).toMatch(/INSUFFICIENT_STOCK/i);

    // c) Available stock never becomes negative (exactly 5 - 4 = 1 unit remaining)
    const finalProduct = memoryDb.products.find((p) => p.id === productId);
    expect(finalProduct).toBeDefined();
    expect(finalProduct!.available_quantity).toBe(1);
    expect(finalProduct!.available_quantity).toBeGreaterThanOrEqual(0);

    // d) Check failed order remained unconfirmed
    const failedOrderId = successes[0].body.data.id === orderAId ? orderBId : orderAId;
    const failedOrder = memoryDb.orders.find((o) => o.id === failedOrderId);
    expect(failedOrder!.status).toBe('pending');
  });

  test('Rollback Guarantee: Multi-product order rolls back completely if any single item lacks stock', async () => {
    // Product 1 has plenty of stock (10 units)
    const prod1Res = await request(app)
      .post('/api/products')
      .set('x-user-role', 'admin')
      .send({
        sku: 'TEST-ROLLBACK-P1',
        name: 'Plentiful Product',
        unit_price: 20.0,
        available_quantity: 10,
        low_stock_threshold: 2,
      });

    // Product 2 has only 1 unit
    const prod2Res = await request(app)
      .post('/api/products')
      .set('x-user-role', 'admin')
      .send({
        sku: 'TEST-ROLLBACK-P2',
        name: 'Scarce Product',
        unit_price: 50.0,
        available_quantity: 1,
        low_stock_threshold: 1,
      });

    const p1Id = prod1Res.body.data.id;
    const p2Id = prod2Res.body.data.id;

    // Create order requesting 5 of P1 and 3 of P2 (P2 will fail)
    const orderRes = await request(app)
      .post('/api/orders')
      .set('x-user-role', 'staff')
      .send({
        items: [
          { product_id: p1Id, quantity: 5 },
          { product_id: p2Id, quantity: 3 }, // Requesting 3 when only 1 exists
        ],
      });

    expect(orderRes.status).toBe(201);
    const orderId = orderRes.body.data.id;

    // Attempt to confirm
    const confirmRes = await request(app)
      .post(`/api/orders/${orderId}/confirm`)
      .set('x-user-role', 'staff');

    expect(confirmRes.status).toBe(409);
    expect(confirmRes.body.error).toContain('INSUFFICIENT_STOCK');

    // VERIFY ZERO PARTIAL DEDUCTION: P1 stock must remain exactly 10!
    const p1After = memoryDb.products.find((p) => p.id === p1Id);
    const p2After = memoryDb.products.find((p) => p.id === p2Id);
    expect(p1After!.available_quantity).toBe(10);
    expect(p2After!.available_quantity).toBe(1);
  });
});
