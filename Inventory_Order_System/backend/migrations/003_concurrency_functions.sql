-- Migration 003: Concurrency-Safe Transactional Functions
-- Real-Time Inventory & Order Reservation System

-- ==============================================================================
-- 1. ATOMIC ORDER CONFIRMATION & STOCK RESERVATION
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.confirm_order_atomic(
    p_order_id TEXT,
    p_actor_email TEXT,
    p_actor_role TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order public.orders%ROWTYPE;
    v_item RECORD;
    v_prod RECORD;
    v_new_qty INTEGER;
    v_reserved_details TEXT := '';
BEGIN
    -- 1. Lock the order row exclusively to prevent concurrent state changes
    SELECT * INTO v_order
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ORDER_NOT_FOUND: Order % does not exist', p_order_id;
    END IF;

    IF v_order.status = 'confirmed' THEN
        RAISE EXCEPTION 'ORDER_ALREADY_CONFIRMED: Order % is already confirmed', p_order_id;
    END IF;

    IF v_order.status = 'fulfilled' THEN
    RAISE EXCEPTION 'INVALID_ORDER_STATE: Fulfilled order % cannot be confirmed again', p_order_id;
    END IF;

    IF v_order.status = 'cancelled' THEN
        RAISE EXCEPTION 'INVALID_ORDER_STATE: Cancelled order % cannot be confirmed', p_order_id;
    END IF;

    -- 2. Concurrency Safety: Lock ALL relevant product rows deterministically (ORDER BY id)
    -- This prevents deadlocks when two orders involve overlapping products in different sequences
    PERFORM 1
    FROM public.products
    WHERE id IN (SELECT product_id FROM public.order_items WHERE order_id = p_order_id)
    ORDER BY id
    FOR UPDATE;

    -- 3. Verify stock sufficiency across all line items (All-or-Nothing check)
    FOR v_item IN
        SELECT oi.product_id, oi.quantity, p.sku, p.name, p.available_quantity, p.low_stock_threshold
        FROM public.order_items oi
        JOIN public.products p ON p.id = oi.product_id
        WHERE oi.order_id = p_order_id
    LOOP
        IF v_item.available_quantity < v_item.quantity THEN
            -- Abort transaction cleanly: Zero stock is reserved, no partial reservations
            RAISE EXCEPTION 'INSUFFICIENT_STOCK: Product % (%) has only % units available, but % were requested',
                v_item.name, v_item.sku, v_item.available_quantity, v_item.quantity;
        END IF;
    END LOOP;

    -- 4. Apply atomic stock deduction and check low stock events
    FOR v_item IN
        SELECT oi.product_id, oi.quantity, p.sku, p.name, p.available_quantity, p.low_stock_threshold
        FROM public.order_items oi
        JOIN public.products p ON p.id = oi.product_id
        WHERE oi.order_id = p_order_id
    LOOP
        v_new_qty := v_item.available_quantity - v_item.quantity;

        UPDATE public.products
        SET available_quantity = v_new_qty,
            updated_at = NOW()
        WHERE id = v_item.product_id;

        v_reserved_details := v_reserved_details || v_item.quantity || 'x ' || v_item.sku || '; ';

        -- Trigger low-stock notification if threshold reached
        IF v_new_qty <= v_item.low_stock_threshold THEN
            INSERT INTO public.notifications (event_id, title, message, type, reference_id, reference_type)
            VALUES (
                'low_stock_' || v_item.product_id || '_' || v_new_qty,
                'Low Stock Warning: ' || v_item.name,
                'Product ' || v_item.sku || ' has reached ' || v_new_qty || ' units remaining (Threshold: ' || v_item.low_stock_threshold || ').',
                'low_stock',
                v_item.product_id::TEXT,
                'product'
            )
            ON CONFLICT (event_id) DO NOTHING;
        END IF;
    END LOOP;

    -- 5. Transition order status to 'confirmed'
    UPDATE public.orders
    SET status = 'confirmed',
        updated_at = NOW()
    WHERE id = p_order_id;

    -- 6. Insert Order Status History
    INSERT INTO public.order_status_history (order_id, previous_status, new_status, actor_email, actor_role, note)
    VALUES (
        p_order_id,
        'pending',
        'confirmed',
        p_actor_email,
        p_actor_role,
        'Stock atomically reserved: ' || v_reserved_details
    );

    -- 7. Insert Audit Log
    INSERT INTO public.audit_logs (actor_email, actor_role, action, entity_type, entity_id, entity_reference, details, reason)
    VALUES (
        p_actor_email,
        p_actor_role,
        'ORDER_CONFIRMED',
        'order',
        p_order_id,
        p_order_id,
        'Atomically reserved stock: ' || v_reserved_details,
        'Order confirmed by authorized staff'
    );

    -- 8. Insert In-App Notification
    INSERT INTO public.notifications (event_id, title, message, type, reference_id, reference_type)
    VALUES (
        'order_confirmed_' || p_order_id,
        'Order Confirmed: ' || p_order_id,
        'Order ' || p_order_id || ' was confirmed and stock reserved by ' || p_actor_email || '.',
        'order_status',
        p_order_id,
        'order'
    )
    ON CONFLICT (event_id) DO NOTHING;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'status', 'confirmed',
        'reserved_items', v_reserved_details
    );
END;
$$;

-- ==============================================================================
-- 2. EXACT-ONCE ORDER CANCELLATION & STOCK RESTORATION
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.cancel_order_atomic(
    p_order_id TEXT,
    p_actor_email TEXT,
    p_actor_role TEXT,
    p_reason TEXT DEFAULT 'Order cancelled by user'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order public.orders%ROWTYPE;
    v_item RECORD;
    v_released_stock BOOLEAN := false;
    v_released_details TEXT := '';
BEGIN
    -- 1. Lock the order row exclusively
    SELECT * INTO v_order
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ORDER_NOT_FOUND: Order % does not exist', p_order_id;
    END IF;

    IF v_order.status = 'cancelled' THEN
        RAISE EXCEPTION 'ORDER_ALREADY_CANCELLED: Order % has already been cancelled', p_order_id;
    END IF;

    IF v_order.status = 'fulfilled' THEN
    RAISE EXCEPTION 'CANNOT_CANCEL_FULFILLED: Fulfilled orders cannot be cancelled';
    END IF;

    -- 2. CRITICAL SAFEGUARD: Only release stock IF the order was in 'confirmed' status
    -- If it was 'pending', stock was never reserved, so releasing stock would create phantom inventory!
    IF v_order.status = 'confirmed' THEN
        v_released_stock := true;

        -- Lock products in deterministic order
        PERFORM 1
        FROM public.products
        WHERE id IN (SELECT product_id FROM public.order_items WHERE order_id = p_order_id)
        ORDER BY id
        FOR UPDATE;

        FOR v_item IN
            SELECT oi.product_id, oi.quantity, p.sku
            FROM public.order_items oi
            JOIN public.products p ON p.id = oi.product_id
            WHERE oi.order_id = p_order_id
        LOOP
            UPDATE public.products
            SET available_quantity = available_quantity + v_item.quantity,
                updated_at = NOW()
            WHERE id = v_item.product_id;

            v_released_details := v_released_details || v_item.quantity || 'x ' || v_item.sku || '; ';
        END LOOP;
    END IF;

    -- 3. Transition order status to 'cancelled'
    UPDATE public.orders
    SET status = 'cancelled',
        updated_at = NOW()
    WHERE id = p_order_id;

    -- 4. Insert Order Status History
    INSERT INTO public.order_status_history (order_id, previous_status, new_status, actor_email, actor_role, note)
    VALUES (
        p_order_id,
        v_order.status,
        'cancelled',
        p_actor_email,
        p_actor_role,
        CASE WHEN v_released_stock
            THEN 'Order cancelled and reserved stock restored: ' || v_released_details || '. Reason: ' || p_reason
            ELSE 'Order cancelled from pending status (No stock was reserved). Reason: ' || p_reason
        END
    );

    -- 5. Insert Audit Log
    INSERT INTO public.audit_logs (actor_email, actor_role, action, entity_type, entity_id, entity_reference, details, reason)
    VALUES (
        p_actor_email,
        p_actor_role,
        'ORDER_CANCELLED',
        'order',
        p_order_id,
        p_order_id,
        CASE WHEN v_released_stock
            THEN 'Cancelled confirmed order and released stock: ' || v_released_details
            ELSE 'Cancelled pending order'
        END,
        p_reason
    );

    -- 6. Insert In-App Notification
    INSERT INTO public.notifications (event_id, title, message, type, reference_id, reference_type)
    VALUES (
        'order_cancelled_' || p_order_id,
        'Order Cancelled: ' || p_order_id,
        'Order ' || p_order_id || ' was cancelled by ' || p_actor_email || '.' || CASE WHEN v_released_stock THEN ' Reserved stock released.' ELSE '' END,
        'order_status',
        p_order_id,
        'order'
    )
    ON CONFLICT (event_id) DO NOTHING;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'status', 'cancelled',
        'released_stock', v_released_stock,
        'details', v_released_details
    );
END;
$$;
