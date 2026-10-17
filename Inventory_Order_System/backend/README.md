# Real-Time Inventory & Order Reservation Backend

A production-quality **Node.js**, **Express.js**, **TypeScript**, and **Supabase PostgreSQL** backend implementing concurrency-safe stock reservation, role-based access control (RBAC), idempotency protection, immutable audit trails, and event-driven notifications for the four-day engineering challenge.

---

## 1. Architecture & Design Principles

```
backend/
├── src/
│   ├── config/              # Environment, Supabase, and Firebase Admin setup
│   ├── controllers/         # Thin HTTP request/response handlers
│   ├── db/                  # PostgreSQL pool and transactional row-mutex engine
│   ├── middleware/          # Supabase auth, RBAC, and centralized error handling
│   ├── routes/              # Centralized REST routing
│   ├── services/            # Pure business logic and transactional coordinators
│   ├── types/               # Strict TypeScript data contracts
│   ├── app.ts               # Express configuration, CORS, and middleware
│   └── server.ts            # Server bootstrap and graceful shutdown
├── migrations/              # Version-controlled Supabase SQL migrations
│   ├── 001_initial_schema.sql
│   ├── 002_rls_policies.sql
│   └── 003_concurrency_functions.sql
├── tests/                   # Automated integration and concurrency tests
│   ├── concurrency.test.ts  # Mandatory Section 10 overselling test
│   └── api.test.ts          # Comprehensive functional & RBAC tests
└── docs/
    └── postman_collection.json # Complete API collection
```

---

## 2. Minimum API Surface Reference

| Method | Endpoint | Authorized Roles | Description |
| :--- | :--- | :---: | :--- |
| `POST` | `/api/products` | `admin` | Create catalog product with SKU uniqueness and threshold |
| `GET` | `/api/products` | `admin`, `staff`, `viewer` | List and search products with query filters |
| `PATCH`| `/api/products/:id` | `admin` | Update product details or deactivate product record |
| `POST` | `/api/stock-adjustments` | `admin`, `staff` | Record a reasoned inventory adjustment (+ / -) |
| `POST` | `/api/orders` | `admin`, `staff` | Create multi-item order with server totals & idempotency |
| `POST` | `/api/orders/:id/confirm` | `admin`, `staff` | Atomically reserve stock under concurrency |
| `POST` | `/api/orders/:id/cancel` | `admin`, `staff` | Cancel order and release stock exactly once |
| `GET` | `/api/orders` | `admin`, `staff`, `viewer` | List orders with pagination metadata |
| `GET` | `/api/orders/:id` | `admin`, `staff`, `viewer` | Get single order details with itemized totals and history |
| `GET` | `/api/audit-logs` | `admin` | Read immutable audit history (Viewer/Staff locked) |
| `GET` | `/api/notifications` | `admin`, `staff`, `viewer` | Retrieve in-app event stream with unread filters |
| `PATCH`| `/api/notifications/:id/read` | `admin`, `staff`, `viewer` | Acknowledge in-app notification |
| `POST` | `/api/notifications/fcm-token` | `admin`, `staff`, `viewer` | Register FCM push device token |

---

## 3. Concurrency Strategy: Prevent Overselling

The central engineering challenge requires guaranteeing that confirmed orders **never reserve more units than are available**, even when multiple users confirm orders simultaneously.

### Strategy Breakdown:
1. **Deterministic Row Locking**: When confirming an order (`confirm_order_atomic`), product rows are locked using `ORDER BY id FOR UPDATE`. Sorting product IDs deterministically completely prevents database deadlocks.
2. **All-or-Nothing Stock Verification**: The database loops over every line item. If even a single item lacks available stock (`available_quantity < quantity`), the entire transaction raises `INSUFFICIENT_STOCK` and **rolls back cleanly**. Zero partial deductions occur.
3. **Exact-Once Stock Release**:
   - Cancelling a `confirmed` order restores reserved stock back to active inventory.
   - Cancelling a `pending` order cancels the order without altering inventory (since pending orders never reserved stock).
   - Cancelling an already cancelled or fulfilled order is rejected with `400 Bad Request`.
4. **Idempotency Protection**: When creating an order with an `idempotency_key`, duplicate requests safely return the existing order without duplicating line items or charging stock.

---

## 4. Database Migrations & Supabase Setup

All migrations are located in `backend/migrations/` and can be executed directly in the **Supabase SQL Editor**:

1. [`001_initial_schema.sql`](migrations/001_initial_schema.sql): Creates all tables (`products`, `orders`, `order_items`, `stock_adjustments`, `order_status_history`, `audit_logs`, `notifications`, `user_push_tokens`) with foreign keys, checks, and numeric money types.
2. [`002_rls_policies.sql`](migrations/002_rls_policies.sql): Enables Row Level Security on all tables and restricts mutations to authorized roles using `public.get_auth_role()`.
3. [`003_concurrency_functions.sql`](migrations/003_concurrency_functions.sql): Installs stored procedures `confirm_order_atomic()` and `cancel_order_atomic()`.

---

## 5. Automated Tests & Acceptance Evidence

### Running the Concurrency Acceptance Test
```bash
npm run test:concurrency
```
**Test Evidence**:
- Creates a product with exactly 5 units available.
- Submits two concurrent order confirmations (Order A requesting 4 units, Order B requesting 4 units) via `Promise.all()`.
- Exactly one order is confirmed with `200 OK`.
- The competing order is rejected with `409 Conflict (INSUFFICIENT_STOCK)`.
- Stock remaining is verified to be exactly **1 unit** (5 - 4 = 1). Available quantity never becomes negative.
- Multi-item rollback test verifies that if any item in a multi-item order lacks stock, all other items in that order are preserved without partial reservation.

### Running the Full Test Suite
```bash
npm run test
```
Runs 18 automated tests across all 6 requirement categories:
- Product creation, validation, and deactivation.
- Unauthorized mutations by Staff and Viewer (403 Forbidden).
- Stock adjustments with mandatory reasons and negative stock protection.
- Server-authoritative line and order calculations.
- Idempotency key deduplication.
- Exact-once cancellation behavior.
- Admin-only audit log access control.
- Event deduplication and notification receipts.

---

## 6. Development Server Setup

```bash
# 1. Install dependencies
npm install

# 2. Compile TypeScript
npm run build

# 3. Start development server with hot-reload
npm run dev
```

Server starts on port `5000` (configurable via `PORT` in `.env`). Health check:
```bash
curl http://localhost:5000/health
```
