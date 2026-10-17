-- Migration 001: Initial Database Schema
-- Real-Time Inventory & Order Reservation System

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. USER ROLES (Associates with Supabase Auth auth.users)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'staff', 'viewer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_roles_email ON public.user_roles(email);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);

-- ==============================================================================
-- 2. PRODUCTS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    sku TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    available_quantity INTEGER NOT NULL CHECK (available_quantity >= 0),
    low_stock_threshold INTEGER NOT NULL CHECK (low_stock_threshold >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products(is_active);

-- ==============================================================================
-- 3. ORDERS (Idempotency and Server Authoritative Totals)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'fulfilled', 'cancelled')) DEFAULT 'pending',
    total_quantity INTEGER NOT NULL CHECK (total_quantity >= 0),
    total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
    created_by TEXT NOT NULL,
    created_by_role TEXT NOT NULL CHECK (created_by_role IN ('admin', 'staff', 'viewer')),
    idempotency_key TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_idempotency ON public.orders(idempotency_key);

-- ==============================================================================
-- 4. ORDER ITEMS (Immutable Price Snapshots & Line Totals)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.order_items (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    sku TEXT NOT NULL,
    name TEXT NOT NULL,
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    line_total NUMERIC(12, 2) NOT NULL CHECK (line_total >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id);

-- ==============================================================================
-- 5. STOCK ADJUSTMENTS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.stock_adjustments (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    product_sku TEXT NOT NULL,
    product_name TEXT NOT NULL,
    acting_user TEXT NOT NULL,
    acting_role TEXT NOT NULL,
    quantity_change INTEGER NOT NULL CHECK (quantity_change != 0),
    reason TEXT NOT NULL CHECK (char_length(trim(reason)) > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_adj_product_id ON public.stock_adjustments(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_adj_created_at ON public.stock_adjustments(created_at DESC);

-- ==============================================================================
-- 6. ORDER STATUS HISTORY
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.order_status_history (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    actor_email TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_hist_order_id ON public.order_status_history(order_id);

-- ==============================================================================
-- 7. AUDIT LOGS (Immutable System Event Ledger)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor_email TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    entity_reference TEXT NOT NULL,
    details TEXT NOT NULL,
    quantity_change INTEGER,
    reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);

-- ==============================================================================
-- 8. NOTIFICATIONS & FCM TOKENS (Event Deduplication)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    event_id TEXT UNIQUE, -- Prevents duplicate event processing from creating duplicate notifications
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('low_stock', 'order_status', 'stock_adjustment', 'system')),
    reference_id TEXT,
    reference_type TEXT,
    read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_event_id ON public.notifications(event_id);

CREATE TABLE IF NOT EXISTS public.user_push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
