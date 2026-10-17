import { memoryDb, getPgPool } from '../db/pool';
import { sendFcmNotification } from '../config/firebase';
import { NotificationItem } from '../types';

export class NotificationService {
  static async createNotification(entry: {
    event_id?: string;
    title: string;
    message: string;
    type: 'low_stock' | 'order_status' | 'stock_adjustment' | 'system';
    reference_id?: string;
    reference_type?: string;
  }): Promise<NotificationItem | null> {
    const pool = getPgPool();

    // 1. Deduplication check: if event_id is supplied and already processed, ignore
    if (entry.event_id) {
      if (pool) {
        const existing = await pool.query(
          'SELECT id FROM public.notifications WHERE event_id = $1 LIMIT 1',
          [entry.event_id]
        );
        if (existing.rows.length > 0) {
          return null;
        }
      } else {
        const existing = memoryDb.notifications.find((n) => n.event_id === entry.event_id);
        if (existing) {
          return null;
        }
      }
    }

    const notificationId = 'notif-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);
    const newNotif: NotificationItem = {
      id: notificationId,
      event_id: entry.event_id,
      title: entry.title,
      message: entry.message,
      type: entry.type,
      reference_id: entry.reference_id,
      reference_type: entry.reference_type,
      read: false,
      created_at: new Date().toISOString(),
    };

    if (pool) {
      const res = await pool.query(
        `INSERT INTO public.notifications (event_id, title, message, type, reference_id, reference_type, read, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (event_id) DO NOTHING
         RETURNING *`,
        [
          newNotif.event_id || null,
          newNotif.title,
          newNotif.message,
          newNotif.type,
          newNotif.reference_id || null,
          newNotif.reference_type || null,
          newNotif.read,
          newNotif.created_at,
        ]
      );
      if (res.rows[0]) {
        newNotif.id = String(res.rows[0].id);
      }
    } else {
      memoryDb.notifications.unshift(newNotif);
    }

    // 2. Dispatch FCM push notification (non-blocking, failure handled gracefully)
    sendFcmNotification({
      title: newNotif.title,
      body: newNotif.message,
      data: {
        type: newNotif.type,
        referenceId: newNotif.reference_id || '',
      },
    }).catch((err) => {
      console.warn('[FCM] Push dispatch note:', err);
    });

    return newNotif;
  }

  static async getNotifications(unreadOnly = false): Promise<NotificationItem[]> {
    const pool = getPgPool();
    if (pool) {
      const query = unreadOnly
        ? 'SELECT * FROM public.notifications WHERE read = false ORDER BY created_at DESC LIMIT 50'
        : 'SELECT * FROM public.notifications ORDER BY created_at DESC LIMIT 50';
      const res = await pool.query(query);
      return res.rows;
    }

    let list = [...memoryDb.notifications];
    if (unreadOnly) {
      list = list.filter((n) => !n.read);
    }
    return list;
  }

  static async markAsRead(id: string): Promise<boolean> {
    const pool = getPgPool();
    if (pool) {
      if (id === 'all') {
        await pool.query('UPDATE public.notifications SET read = true');
        return true;
      }
      const res = await pool.query('UPDATE public.notifications SET read = true WHERE id = $1', [id]);
      return (res.rowCount || 0) > 0;
    }

    if (id === 'all') {
      memoryDb.notifications.forEach((n) => {
        n.read = true;
      });
      return true;
    }

    const notif = memoryDb.notifications.find((n) => n.id === id);
    if (notif) {
      notif.read = true;
      return true;
    }
    return false;
  }

  static async registerFcmToken(userEmail: string, token: string): Promise<void> {
    const pool = getPgPool();
    if (pool) {
      await pool.query(
        `INSERT INTO public.user_push_tokens (user_email, token)
         VALUES ($1, $2)
         ON CONFLICT (token) DO NOTHING`,
        [userEmail, token]
      );
    } else {
      if (!memoryDb.pushTokens.includes(token)) {
        memoryDb.pushTokens.push(token);
      }
    }
  }
}
