# Acceptance Test & Verification Guide
## Real-Time Inventory & Order Reservation System

This guide provides step-by-step instructions for running automated and manual verification tests against the live Supabase PostgreSQL database.

---

### 1. Automated Concurrency & Live Database Test

Run the end-to-end automated verification script that executes real transactions against live Supabase PostgreSQL:

```bash
cd backend
npm run test:live
```

#### What this test verifies automatically:
1. **Product Persistence**: Creates a new product via frontend proxy (`POST /api/products`), immediately queries `public.products` in Supabase to confirm direct storage.
2. **Stock Adjustment & Audit Trail**: Performs a reasoned adjustment (+5 units) via `POST /api/stock-adjustments`, confirms quantity update in `public.products` and verifies corresponding record in `public.audit_logs`.
3. **Pending Order Invariant**: Creates a multi-item order via `POST /api/orders`, verifies order in `public.orders` with status `pending`, and proves that available stock in `public.products` remains untouched before confirmation.
4. **Order Confirmation & Atomic Reservation**: Confirms the order via `POST /api/orders/:id/confirm`, executes `confirm_order_atomic` in Supabase, and confirms available stock deduction.
5. **Section 10 Concurrency Contention Acceptance Test**:
   - Creates two simultaneous orders (Order A and Order B) requesting 4 units each when only 6 units remain in Supabase.
   - Dispatches simultaneous confirmation requests at the exact same millisecond.
   - **Verification**: Exactly 1 order succeeds (HTTP 200, status `confirmed`), and exactly 1 order is rejected with HTTP 409 Conflict (`INSUFFICIENT_STOCK`).
   - Verifies remaining stock in Supabase is exactly 2 units (never negative).
   - Verifies low-stock event triggered and notification recorded in `public.notifications`.
6. **Exact-Once Order Cancellation & Stock Restoration**:
   - Cancels the confirmed order: verifies reserved stock (+4) is restored to inventory in Supabase (2 -> 6).
   - Cancels the pending/rejected order: verifies zero stock is released (inventory stays at 6, proving no phantom stock).
   - Attempts double cancellation on the already-cancelled order: rejects with HTTP 400 (`ORDER_ALREADY_CANCELLED`).
7. **Frontend Proxy Audit & Notifications**: Queries `/api/audit-logs` and `/api/notifications` through Next.js proxy, confirming full data retrieval from live Supabase.

---

### 2. Manual End-to-End Verification via Web UI

Start both the frontend and backend servers:

```bash
# Terminal 1 - Backend (port 5000)
cd backend
npm run dev

# Terminal 2 - Frontend (port 3000)
npm run dev
```

Open `http://localhost:3000` in your browser.

#### Test Scenario A: Role-Based Access Control (RBAC)
1. Use the **Test Role** switcher in the top navigation bar to toggle between **Admin**, **Staff**, and **Viewer**.
2. As **Viewer**:
   - Navigate to `/products`: notice the **"Add Product"** button is hidden/disabled.
   - Navigate to `/orders/create`: notice action is blocked.
   - Navigate to `/audit-logs`: notice the **Access Denied** message.
3. As **Staff**:
   - Navigate to `/orders/create`: allowed to create orders.
   - Navigate to `/audit-logs`: access denied (Admin only).
4. As **Admin**:
   - Full access to all product mutations, stock adjustments, orders, and audit logs.

#### Test Scenario B: Stock Adjustment
1. Navigate to `/stock-adjustments`.
2. Select any product from the dropdown.
3. Select **Increase (+)** or **Decrease (-)** and enter a quantity.
4. Provide a mandatory reason (e.g., `"Manual cycle count correction"`).
5. Click **"Apply Stock Adjustment"**.
6. Check that the stock adjustment history updates and the product quantity reflects the change immediately.

#### Test Scenario C: Order Lifecycle
1. Navigate to `/orders/create`.
2. Select one or more products and add quantities. Notice the live authoritative total preview.
3. Click **"Submit Order"**. Order is created with status **Pending**.
4. Click on the created order in `/orders` to view its detail page (`/orders/[id]`).
5. Click **"Confirm & Reserve Stock"**:
   - Status updates to **Confirmed**.
   - Product stock is deducted.
   - Status timeline records timestamp and actor.
6. Click **"Cancel Order"**:
   - Enter a reason and confirm.
   - Status updates to **Cancelled**.
   - Reserved stock is restored.

---

### 3. Unit & Integration Test Suite

Run the full Jest test suite in the backend:

```bash
cd backend
npm test
```

Expected result:
- `tests/api.test.ts`: 16/16 passed
- `tests/concurrency.test.ts`: 2/2 passed
- **Total: 18 passed, 18 total**
