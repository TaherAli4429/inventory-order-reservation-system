import { Router } from 'express';
import { OrderController } from '../controllers/order.controller';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/role';

const router = Router();

// GET /api/orders - List orders with pagination
router.get('/', authenticate, OrderController.getOrders);

// GET /api/orders/:id - Fetch single order details
router.get('/:id', authenticate, OrderController.getOrderById);

// POST /api/orders - Create order with idempotency protection (Admin and Staff)
router.post(
  '/',
  authenticate,
  requireRole('admin', 'staff'),
  OrderController.createOrder
);

// POST /api/orders/:id/confirm - Atomically reserve stock and confirm order (Admin and Staff)
router.post(
  '/:id/confirm',
  authenticate,
  requireRole('admin', 'staff'),
  OrderController.confirmOrder
);

// POST /api/orders/:id/cancel - Cancel order and release stock exactly once (Admin and Staff)
router.post(
  '/:id/cancel',
  authenticate,
  requireRole('admin', 'staff'),
  OrderController.cancelOrder
);

export default router;
