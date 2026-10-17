import { Router } from 'express';
import { AuditLogController } from '../controllers/auditLog.controller';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/role';

const router = Router();

// GET /api/audit-logs - Read audit history (Strictly Admin only)
router.get('/', authenticate, requireRole('admin'), AuditLogController.getAuditLogs);

export default router;
