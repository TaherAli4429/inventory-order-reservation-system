# Real-Time Inventory & Order Reservation System

A production-grade, enterprise-scale full-stack system delivering **real-time stock management**, **concurrency-safe order reservations**, **role-based access control (RBAC)**, **immutable audit logging**, and **event-driven notifications** according to the official four-day internship assignment specification.

---

## 1. System Architecture & Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Lucide Icons (`http://localhost:3000`)
- **Backend**: Node.js, Express.js, TypeScript, PostgreSQL Connection Pool (`http://localhost:5000`)
- **Database**: Supabase PostgreSQL with IPv4 Transaction Pooler & PL/pgSQL Atomic Procedures
- **Push Notifications**: Firebase Cloud Messaging (FCM) Web Push & In-App Event Pipeline
- **Concurrency Safety**: Deterministic row-level locking (`FOR UPDATE`), atomic stored procedures (`confirm_order_atomic`, `cancel_order_atomic`), and all-or-nothing rollback guarantees

```
[ Next.js 14 Web Client ]
         │ (HTTP / JSON)
         ▼
[ Next.js App Router Proxy (/api/*) ]
         │ (HTTP / Forward Headers: x-user-email, x-user-role, idempotency-key)
         ▼
[ Express.js Backend Server (Port 5000) ]
         │
         ├──► [ Supabase IPv4 Pooler (aws-0-ap-south-1.pooler.supabase.com:5432) ]
         │         ├── public.products (Row-level locked FOR UPDATE)
         │         ├── public.orders & public.order_items
         │         ├── public.stock_adjustments
         │         ├── public.order_status_history
         │         ├── public.audit_logs (Immutable audit trail)
         │         ├── public.notifications & user_push_tokens
         │         └── Stored Procedures: confirm_order_atomic, cancel_order_atomic
         │
         └──► [ Firebase Cloud Messaging (FCM) Web Push Dispatcher ]
```

---

## 2. Requirements Compliance Matrix

| PDF Requirement | Backend Implementation | Frontend UI / Route | Status |
| :--- | :--- | :--- | :--- |
| **Authentication & RBAC** | JWT validation & RBAC middleware (`auth.ts`, `role.ts`) | Switcher in header, `/login`, `AuthContext.tsx` | Complete & Verified |
| **Product Management** | `GET/POST /api/products`, `PATCH /api/products/:id` | `/products`, Product Table, Add Modal, Deactivate | Complete & Verified |
| **Stock Adjustments** | `POST /api/stock-adjustments` (atomic update + audit) | `/stock-adjustments`, Reasoned +/- Modal, History | Complete & Verified |
| **Order Creation** | `POST /api/orders` (server-authoritative totals) | `/orders/create`, Multi-item builder, Price Preview | Complete & Verified |
| **Idempotency** | `idempotency-key` header & DB unique constraint | Generated on client (`crypto.randomUUID()`) | Complete & Verified |
| **Atomic Reservation** | `POST /api/orders/:id/confirm` (`confirm_order_atomic`) | `/orders/[id]`, "Confirm & Reserve Stock" CTA | Complete & Verified |
| **Concurrency Safeguard**| Rejects overselling with `409 Conflict` (`INSUFFICIENT_STOCK`) | Amber conflict banner and clean rejection message | Complete & Verified |
| **Exact-Once Cancellation**| `POST /api/orders/:id/cancel` (`cancel_order_atomic`)| `/orders/[id]`, "Cancel Order" Modal with reason | Complete & Verified |
| **Audit Logs** | Immutable `public.audit_logs` (Admin only) | `/audit-logs`, Filterable event table | Complete & Verified |
| **Low-Stock Alerts** | Automatic threshold check & deduplicated event | Header bell counter, notification list, badge | Complete & Verified |
| **FCM Push** | Device token registration & push dispatch | Browser push subscription prompt, Web Push | Complete & Verified |

---

## 3. Concurrency Protection & Invariants

1. **Deterministic Row Locks**: Multi-item orders lock product rows ordered by `id` (`ORDER BY id FOR UPDATE`), completely preventing deadlocks between concurrent cross-product orders.
2. **All-or-Nothing Reservation**: If any single line item in an order exceeds available stock, the entire reservation is aborted with `409 Conflict`. Zero stock is partially reserved across any item.
3. **Pending Order Invariant**: Orders in `pending` status do not deduct stock. Stock is only reserved when transitioned to `confirmed`.
4. **Exact-Once Cancellation**:
   - Cancelling a `confirmed` order restores reserved stock exactly once.
   - Cancelling a `pending` order restores zero stock (preventing phantom inventory).
   - Re-cancelling an already cancelled order is rejected with `400 Bad Request`.

---

## 4. Setup & Running Instructions

### 4.1 Prerequisites
- Node.js 18+ (tested on Node v20/v24)
- PostgreSQL / Supabase account (credentials configured in `backend/.env`)

### 4.2 Backend Setup
```bash
cd backend
npm install
npm run type-check
npm run build
npm run dev
```
The Express backend starts on `http://localhost:5000`. Verify health at `http://localhost:5000/health`:
```json
{
  "status": "ok",
  "database": "PostgreSQL Connected",
  "storage": "Supabase PostgreSQL"
}
```

### 4.3 Frontend Setup
```bash
# In project root
npm install
npm run type-check
npm run build
npm run dev
```
The Next.js App Router starts on `http://localhost:3000`.

---

## 5. Automated Verification & Testing

### 5.1 Run Live Supabase End-to-End Test (Section 10 Acceptance Test)
Directly tests against live Supabase PostgreSQL transactions and concurrency contention:
```bash
cd backend
npm run test:live
```
**Results verified by this script:**
- Product insertion into `public.products`.
- Reasoned stock adjustment (+5) and audit log in `public.audit_logs`.
- Multi-item order creation with server-authoritative totals.
- Atomic stock reservation via `confirm_order_atomic`.
- **Section 10 Acceptance Test**: 2 simultaneous requests for 4 units when only 6 exist -> exactly 1 succeeds (200), exactly 1 rejected with 409 Conflict (`INSUFFICIENT_STOCK`), remaining stock = 2.
- Low-stock warning notification automatically triggered.
- Confirmed order cancellation restoring stock (+4 to 6).
- Pending order cancellation restoring zero stock (preventing phantom stock).
- Double cancellation protection returning 400 Bad Request.

### 5.2 Run Jest Backend Test Suite
```bash
cd backend
npm test
```
Runs 18 unit and integration tests across products, stock adjustments, order idempotency, and concurrency safeguards.

---

## 6. Project Documentation
- [System Architecture & ER Diagram](docs/ARCHITECTURE.md)
- [Acceptance Test & Verification Guide](docs/ACCEPTANCE_TEST_GUIDE.md)
- [Postman API Collection](docs/inventory_order_system.postman_collection.json)
