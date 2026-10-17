import { Router } from 'express';
import { StockAdjustmentController } from '../controllers/stockAdjustment.controller';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/role';

const router = Router();

// GET /api/stock-adjustments - List stock adjustment history
router.get('/', authenticate, StockAdjustmentController.getAdjustments);

// POST /api/stock-adjustments - Record a reasoned stock adjustment (Admin and Staff)
router.post(
  '/',
  authenticate,
  requireRole('admin', 'staff'),
  StockAdjustmentController.createAdjustment
);

export default router;
