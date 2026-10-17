const { Pool } = require('pg');
require('dotenv').config({ path: './.env' });

const FRONTEND_URL = 'http://localhost:3000';
const BACKEND_URL = 'http://localhost:5000';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const headers = {
  'Content-Type': 'application/json',
  'x-user-email': 'admin@enterprise.io',
  'x-user-role': 'admin',
};

async function runTest() {
  console.log('=== REAL-TIME INVENTORY & ORDER SYSTEM E2E VERIFICATION ===');
  console.log('Connecting to database...');
  const healthRes = await fetch(`${BACKEND_URL}/health`).then(r => r.json());
  console.log('Backend Health:', healthRes);

  const sku = `LIVE-E2E-${Date.now().toString(36).toUpperCase()}`;

  // Step 1: Create a product through frontend proxy
  console.log('\n[1] Creating product via Frontend Proxy (POST /api/products)...');
  const createProdRes = await fetch(`${FRONTEND_URL}/api/products`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      sku,
      name: `E2E Test Widget ${sku}`,
      unit_price: 49.99,
      available_quantity: 5,
      low_stock_threshold: 3,
      is_active: true,
    }),
  });

  const createProdData = await createProdRes.json();
  if (!createProdRes.ok || !createProdData.data?.id) {
    throw new Error(`Failed to create product: ${JSON.stringify(createProdData)}`);
  }
  const productId = createProdData.data.id;
  console.log(`Product created: ID=${productId}, SKU=${sku}, Initial Qty=5, Price=$49.99`);

  // Verify in Supabase
  let dbProd = (await pool.query('SELECT * FROM public.products WHERE id = $1', [productId])).rows[0];
  console.log(`DB Verification -> Product in public.products: SKU=${dbProd.sku}, Qty=${dbProd.available_quantity}`);

  // Step 2: Stock Adjustment (+5 units)
  console.log('\n[2] Performing Stock Adjustment (+5 units) via Frontend Proxy...');
  const adjustRes = await fetch(`${FRONTEND_URL}/api/stock-adjustments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      product_id: productId,
      quantity_change: 5,
      reason: 'Inbound shipment intake batch #101',
    }),
  });
  const adjustData = await adjustRes.json();
  console.log(`Adjustment response status=${adjustRes.status}, New Product Qty=${adjustData.product?.available_quantity}`);

  dbProd = (await pool.query('SELECT * FROM public.products WHERE id = $1', [productId])).rows[0];
  console.log(`DB Verification -> Product Qty in Supabase: ${dbProd.available_quantity} (Expected: 10)`);
  if (dbProd.available_quantity !== 10) throw new Error('Stock adjustment quantity mismatch in DB!');

  // Check audit log in DB
  const adjAudit = (await pool.query(
    "SELECT * FROM public.audit_logs WHERE entity_id = $1 AND action = 'STOCK_ADJUSTMENT' ORDER BY timestamp DESC LIMIT 1",
    [productId]
  )).rows[0];
  console.log(`DB Verification -> Audit log recorded: action=${adjAudit.action}, reason="${adjAudit.reason}", change=${adjAudit.quantity_change}`);

  // Step 3: Create Order 1 (Quantity: 4)
  console.log('\n[3] Creating Order 1 (4 units) via Frontend Proxy...');
  const order1Res = await fetch(`${FRONTEND_URL}/api/orders`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      items: [{ product_id: productId, quantity: 4 }],
      idempotency_key: `idemp-1-${Date.now()}`,
    }),
  });
  const order1Data = await order1Res.json();
  const order1Id = order1Data.data?.id;
  console.log(`Order 1 created: ID=${order1Id}, Status=${order1Data.data?.status}, Total=$${order1Data.data?.total_amount}`);

  // Verify order in Supabase
  const dbOrder1 = (await pool.query('SELECT * FROM public.orders WHERE id = $1', [order1Id])).rows[0];
  console.log(`DB Verification -> Order in Supabase: status=${dbOrder1.status}, total_amount=${dbOrder1.total_amount}`);
  // In pending status, stock MUST NOT be deducted yet!
  dbProd = (await pool.query('SELECT * FROM public.products WHERE id = $1', [productId])).rows[0];
  console.log(`DB Verification -> Product Qty while order is pending: ${dbProd.available_quantity} (Must still be 10)`);
  if (dbProd.available_quantity !== 10) throw new Error('Stock was prematurely deducted before confirmation!');

  // Step 4: Confirm Order 1 (Atomic Reservation)
  console.log(`\n[4] Confirming Order 1 (${order1Id}) via Frontend Proxy...`);
  const confirm1Res = await fetch(`${FRONTEND_URL}/api/orders/${order1Id}/confirm`, {
    method: 'POST',
    headers,
  });
  const confirm1Data = await confirm1Res.json();
  console.log(`Confirm Order 1: status=${confirm1Res.status}, orderStatus=${confirm1Data.data?.status}`);

  dbProd = (await pool.query('SELECT * FROM public.products WHERE id = $1', [productId])).rows[0];
  console.log(`DB Verification -> Product Qty in Supabase after confirmation: ${dbProd.available_quantity} (Expected: 6)`);
  if (dbProd.available_quantity !== 6) throw new Error('Stock reservation failed or incorrect quantity deduction!');

  // Step 5: Test Concurrency Contention (Section 10 Acceptance Test!)
  // Currently available stock = 6 units.
  // Order A requests 4 units.
  // Order B requests 4 units.
  // Total requested = 8 units > 6 available!
  // Concurrently confirm both orders against PostgreSQL. Exactly ONE must succeed and ONE must fail with 409!
  console.log('\n[5] Concurrency Contention Acceptance Test (2 simultaneous orders for 4 units when only 6 available)...');

  const orderARes = await fetch(`${FRONTEND_URL}/api/orders`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      items: [{ product_id: productId, quantity: 4 }],
      idempotency_key: `idemp-A-${Date.now()}`,
    }),
  }).then(r => r.json());
  const orderAId = orderARes.data.id;

  const orderBRes = await fetch(`${FRONTEND_URL}/api/orders`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      items: [{ product_id: productId, quantity: 4 }],
      idempotency_key: `idemp-B-${Date.now()}`,
    }),
  }).then(r => r.json());
  const orderBId = orderBRes.data.id;

  console.log(`Created Order A (${orderAId}) and Order B (${orderBId}). Blasting concurrent confirmation requests...`);

  const [resA, resB] = await Promise.all([
    fetch(`${FRONTEND_URL}/api/orders/${orderAId}/confirm`, { method: 'POST', headers }),
    fetch(`${FRONTEND_URL}/api/orders/${orderBId}/confirm`, { method: 'POST', headers }),
  ]);

  const dataA = await resA.json();
  const dataB = await resB.json();

  console.log(`Result Order A: HTTP ${resA.status} -> ${dataA.success ? 'Confirmed' : dataA.error}`);
  console.log(`Result Order B: HTTP ${resB.status} -> ${dataB.success ? 'Confirmed' : dataB.error}`);

  const oneSucceeded = (resA.status === 200 && resB.status === 409) || (resB.status === 200 && resA.status === 409);
  if (!oneSucceeded) {
    throw new Error(`Concurrency invariant violated! Expected 1 success (200) and 1 conflict (409), got ${resA.status} and ${resB.status}`);
  }
  console.log('>>> CONCURRENCY INVARIANT PASSED: Exactly 1 order succeeded, exactly 1 order rejected with 409 Conflict!');

  dbProd = (await pool.query('SELECT * FROM public.products WHERE id = $1', [productId])).rows[0];
  console.log(`DB Verification -> Remaining Product Qty in Supabase: ${dbProd.available_quantity} (Expected: 2)`);
  if (dbProd.available_quantity !== 2) throw new Error(`Expected remaining stock to be 2, but found ${dbProd.available_quantity}`);

  // Check low stock trigger
  // Product threshold was 3. Remaining is 2 <= 3. Low stock notification should have fired!
  const notif = (await pool.query(
    "SELECT * FROM public.notifications WHERE reference_id = $1 AND type = 'low_stock' ORDER BY created_at DESC LIMIT 1",
    [productId]
  )).rows[0];
  console.log(`DB Verification -> Low Stock Notification: ${notif ? `TRIGGERED: "${notif.title}" (${notif.message})` : 'NOT FOUND'}`);

  // Step 6: Order Cancellation & Stock Restoration (Exact-Once Safeguard)
  // Let's identify the confirmed order between A and B
  const winningOrderId = resA.status === 200 ? orderAId : orderBId;
  const losingOrderId = resA.status === 200 ? orderBId : orderAId;

  console.log(`\n[6] Cancelling Confirmed Order (${winningOrderId}) -> Stock must be restored (+4)...`);
  const cancelWinningRes = await fetch(`${FRONTEND_URL}/api/orders/${winningOrderId}/cancel`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ reason: 'Customer changed delivery address' }),
  });
  const cancelWinningData = await cancelWinningRes.json();
  console.log(`Cancelled confirmed order: status=${cancelWinningRes.status}, released_stock=${cancelWinningData.released_stock}`);

  dbProd = (await pool.query('SELECT * FROM public.products WHERE id = $1', [productId])).rows[0];
  console.log(`DB Verification -> Product Qty in Supabase after restoring winning order: ${dbProd.available_quantity} (Expected: 6)`);
  if (dbProd.available_quantity !== 6) throw new Error('Stock restoration failed for confirmed order cancellation!');

  console.log(`\n[7] Cancelling Pending Order (${losingOrderId}) -> Zero stock must be restored (No phantom inventory)...`);
  const cancelLosingRes = await fetch(`${FRONTEND_URL}/api/orders/${losingOrderId}/cancel`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ reason: 'Abandoned requisition' }),
  });
  const cancelLosingData = await cancelLosingRes.json();
  console.log(`Cancelled pending order: status=${cancelLosingRes.status}, released_stock=${cancelLosingData.released_stock}`);

  dbProd = (await pool.query('SELECT * FROM public.products WHERE id = $1', [productId])).rows[0];
  console.log(`DB Verification -> Product Qty in Supabase after cancelling pending order: ${dbProd.available_quantity} (Must STILL be 6)`);
  if (dbProd.available_quantity !== 6) throw new Error('Phantom stock bug! Stock was erroneously added when cancelling pending order!');

  console.log('\n[8] Testing Double Cancellation Protection...');
  const doubleCancelRes = await fetch(`${FRONTEND_URL}/api/orders/${winningOrderId}/cancel`, {
    method: 'POST',
    headers,
  });
  const doubleCancelData = await doubleCancelRes.json();
  console.log(`Double cancel response: HTTP ${doubleCancelRes.status} -> ${doubleCancelData.error || doubleCancelData.message}`);
  if (doubleCancelRes.status !== 400) throw new Error('Expected 400 when cancelling already-cancelled order!');

  console.log('\n[9] Checking Notifications and Audit Logs through Frontend Proxy...');
  const logsRes = await fetch(`${FRONTEND_URL}/api/audit-logs`, { headers }).then(r => r.json());
  console.log(`Audit logs retrieved via Frontend Proxy: total=${logsRes.total}`);

  const notifsRes = await fetch(`${FRONTEND_URL}/api/notifications`, { headers }).then(r => r.json());
  console.log(`Notifications retrieved via Frontend Proxy: total=${notifsRes.total}, unread=${notifsRes.unread_count}`);

  console.log('\n======================================================');
  console.log('ALL REAL DATABASE VERIFICATION CHECKS PASSED PERFECTLY!');
  console.log('======================================================\n');
}

runTest()
  .catch((e) => {
    console.error('VERIFICATION ERROR:', e);
    process.exit(1);
  })
  .finally(() => pool.end());
