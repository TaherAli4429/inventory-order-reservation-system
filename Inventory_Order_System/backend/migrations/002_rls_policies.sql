-- Migration 002: Row Level Security (RLS) Policies
-- Real-Time Inventory & Order Reservation System

-- Enable RLS on all business tables
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;

-- Security helper to get current authenticated user's role from user_roles table
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid() OR email = auth.jwt() ->> 'email' LIMIT 1;
$$;

-- ==============================================================================
-- PRODUCTS POLICIES
-- ==============================================================================
-- Authenticated users (Admin, Staff, Viewer) can view products
CREATE POLICY "Authenticated users can view products"
    ON public.products FOR SELECT
    TO authenticated
    USING (true);

-- Only Admin can insert products
CREATE POLICY "Admin can insert products"
    ON public.products FOR INSERT
    TO authenticated
    WITH CHECK (public.get_auth_role() = 'admin');

-- Only Admin can update products directly
CREATE POLICY "Admin can update products"
    ON public.products FOR UPDATE
    TO authenticated
    USING (public.get_auth_role() = 'admin')
    WITH CHECK (public.get_auth_role() = 'admin');

-- Physical deletion is strictly prohibited
CREATE POLICY "Physical deletion of products is prohibited"
    ON public.products FOR DELETE
    TO authenticated
    USING (false);

-- ==============================================================================
-- ORDERS & ORDER ITEMS POLICIES
-- ==============================================================================
-- Admin, Staff, and Viewer can view orders
CREATE POLICY "Authenticated users can view orders"
    ON public.orders FOR SELECT
    TO authenticated
    USING (true);

-- Admin and Staff can create orders (Viewer is locked)
CREATE POLICY "Admin and Staff can create orders"
    ON public.orders FOR INSERT
    TO authenticated
    WITH CHECK (public.get_auth_role() IN ('admin', 'staff'));

-- Only Admin and Staff can update order lifecycle
CREATE POLICY "Admin and Staff can update orders"
    ON public.orders FOR UPDATE
    TO authenticated
    USING (public.get_auth_role() IN ('admin', 'staff'))
    WITH CHECK (public.get_auth_role() IN ('admin', 'staff'));

-- Order items select & insert
CREATE POLICY "Authenticated users can view order items"
    ON public.order_items FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admin and Staff can insert order items"
    ON public.order_items FOR INSERT
    TO authenticated
    WITH CHECK (public.get_auth_role() IN ('admin', 'staff'));

-- ==============================================================================
-- STOCK ADJUSTMENTS POLICIES
-- ==============================================================================
CREATE POLICY "Authenticated users can view stock adjustments"
    ON public.stock_adjustments FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admin and Staff can insert stock adjustments"
    ON public.stock_adjustments FOR INSERT
    TO authenticated
    WITH CHECK (public.get_auth_role() IN ('admin', 'staff'));

-- ==============================================================================
-- AUDIT LOGS POLICIES (Admin Only)
-- ==============================================================================
CREATE POLICY "Only Admin can view audit logs"
    ON public.audit_logs FOR SELECT
    TO authenticated
    USING (public.get_auth_role() = 'admin');

CREATE POLICY "System/Backend can insert audit logs"
    ON public.audit_logs FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- No one can modify or delete audit history
CREATE POLICY "Audit history is immutable"
    ON public.audit_logs FOR UPDATE
    TO authenticated
    USING (false);

CREATE POLICY "Audit deletion is prohibited"
    ON public.audit_logs FOR DELETE
    TO authenticated
    USING (false);

-- ==============================================================================
-- NOTIFICATIONS POLICIES
-- ==============================================================================
CREATE POLICY "Authenticated users can view notifications"
    ON public.notifications FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can update notification read status"
    ON public.notifications FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);
