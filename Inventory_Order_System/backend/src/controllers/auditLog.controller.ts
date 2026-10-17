import { Request, Response, NextFunction } from 'express';
import { AuditLogService } from '../services/auditLog.service';

export class AuditLogController {
  static async getAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { action, entity_type, q } = req.query;
      const logs = await AuditLogService.getAuditLogs({
        action: action ? String(action) : undefined,
        entity_type: entity_type ? String(entity_type) : undefined,
        q: q ? String(q) : undefined,
      });
      res.status(200).json({
        success: true,
        data: logs,
        total: logs.length,
      });
    } catch (err) {
      next(err);
    }
  }
}
