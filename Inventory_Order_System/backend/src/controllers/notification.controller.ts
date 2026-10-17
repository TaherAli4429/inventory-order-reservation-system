import { Request, Response, NextFunction } from 'express';
import { NotificationService } from '../services/notification.service';

export class NotificationController {
  static async getNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const unreadOnly = req.query.unread === 'true';
      const notifications = await NotificationService.getNotifications(unreadOnly);
      const unreadCount = notifications.filter((n) => !n.read).length;
      res.status(200).json({
        success: true,
        data: notifications,
        unread_count: unreadCount,
        total: notifications.length,
      });
    } catch (err) {
      next(err);
    }
  }

  static async markRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      await NotificationService.markAsRead(id);
      res.status(200).json({
        success: true,
        message: 'Notification marked as read',
      });
    } catch (err) {
      next(err);
    }
  }

  static async registerToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.body;
      if (!token) {
        res.status(400).json({ success: false, error: 'Device token is required' });
        return;
      }
      await NotificationService.registerFcmToken(req.user?.email || 'user@enterprise.io', token);
      res.status(200).json({
        success: true,
        message: 'FCM push token registered successfully',
      });
    } catch (err) {
      next(err);
    }
  }
}
