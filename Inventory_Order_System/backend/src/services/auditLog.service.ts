import { memoryDb, getPgPool } from '../db/pool';
import { AuditLog, UserRole } from '../types';

export class AuditLogService {
  static async record(entry: {
    actor_email: string;
    actor_role: UserRole;
    action: string;
    entity_type: string;
    entity_id: string;
    entity_reference: string;
    details: string;
    quantity_change?: number;
    reason?: string;
  }): Promise<AuditLog> {
    const pool = getPgPool();
    const logId = 'audit-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);
    const log: AuditLog = {
      id: logId,
      timestamp: new Date().toISOString(),
      actor_email: entry.actor_email,
      actor_role: entry.actor_role,
      action: entry.action,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id,
      entity_reference: entry.entity_reference,
      details: entry.details,
      quantity_change: entry.quantity_change,
      reason: entry.reason,
    };

    if (pool) {
      const res = await pool.query(
        `INSERT INTO public.audit_logs (timestamp, actor_email, actor_role, action, entity_type, entity_id, entity_reference, details, quantity_change, reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          log.timestamp,
          log.actor_email,
          log.actor_role,
          log.action,
          log.entity_type,
          log.entity_id,
          log.entity_reference,
          log.details,
          log.quantity_change || null,
          log.reason || null,
        ]
      );
      if (res.rows[0]) {
        log.id = String(res.rows[0].id);
      }
    } else {
      memoryDb.auditLogs.unshift(log);
    }

    return log;
  }

  static async getAuditLogs(params?: {
    action?: string;
    entity_type?: string;
    q?: string;
  }): Promise<AuditLog[]> {
    const pool = getPgPool();
    if (pool) {
      const conditions: string[] = [];
      const values: (string | number)[] = [];

      if (params?.action && params.action !== 'all') {
        values.push(params.action);
        conditions.push(`action = $${values.length}`);
      }
      if (params?.entity_type && params.entity_type !== 'all') {
        values.push(params.entity_type);
        conditions.push(`entity_type = $${values.length}`);
      }
      if (params?.q) {
        values.push(`%${params.q.toLowerCase()}%`);
        conditions.push(
          `(LOWER(actor_email) LIKE $${values.length} OR LOWER(entity_reference) LIKE $${values.length} OR LOWER(details) LIKE $${values.length} OR LOWER(reason) LIKE $${values.length})`
        );
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const query = `SELECT * FROM public.audit_logs ${whereClause} ORDER BY timestamp DESC LIMIT 100`;
      const res = await pool.query(query, values);
      return res.rows;
    }

    let logs = [...memoryDb.auditLogs];
    if (params?.action && params.action !== 'all') {
      logs = logs.filter((l) => l.action === params.action);
    }
    if (params?.entity_type && params.entity_type !== 'all') {
      logs = logs.filter((l) => l.entity_type === params.entity_type);
    }
    if (params?.q) {
      const q = params.q.toLowerCase();
      logs = logs.filter(
        (l) =>
          l.actor_email.toLowerCase().includes(q) ||
          l.entity_reference.toLowerCase().includes(q) ||
          l.details.toLowerCase().includes(q) ||
          (l.reason && l.reason.toLowerCase().includes(q))
      );
    }
    return logs;
  }
}
