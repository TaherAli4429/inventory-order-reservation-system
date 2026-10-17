import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// GET /api/notifications - List in-app notifications
router.get('/', authenticate, NotificationController.getNotifications);

// PATCH /api/notifications/:id/read - Mark notification as read
router.patch('/:id/read', authenticate, NotificationController.markRead);

// POST /api/notifications/fcm-token - Register FCM push token
router.post('/fcm-token', authenticate, NotificationController.registerToken);

export default router;
