import { Router } from 'express';
import { getNotifications, markAllNotificationsRead, markNotificationRead } from '../controllers/notificationController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken as any);

router.get('/', getNotifications);
router.put('/read', markAllNotificationsRead);
router.put('/:id/read', markNotificationRead);

export default router;
