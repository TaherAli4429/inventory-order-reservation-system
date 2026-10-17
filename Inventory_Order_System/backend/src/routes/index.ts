import { Router } from 'express';
import productRoutes from './product.routes';
import stockAdjustmentRoutes from './stockAdjustment.routes';
import orderRoutes from './order.routes';
import auditLogRoutes from './auditLog.routes';
import notificationRoutes from './notification.routes';

const router = Router();

router.use('/products', productRoutes);
router.use('/stock-adjustments', stockAdjustmentRoutes);
router.use('/orders', orderRoutes);
router.use('/audit-logs', auditLogRoutes);
router.use('/notifications', notificationRoutes);

export default router;
