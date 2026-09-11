import { Router } from 'express';
import {
  getNotifications,
  markNotificationRead,
  getAssignments,
  submitAssignment,
  getDiscussionTopics,
  createDiscussionTopic,
  getDiscussionReplies,
  createDiscussionReply
} from '../controllers/studentController';
import { getStudentOrders } from '../controllers/paymentController';
import { getMyXpAnalytics } from '../controllers/studyController';
import { getMyExpiringCourses } from '../controllers/enrollmentExpiryController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken as any);

// Course Expiration & Renewal Alerts
router.get('/expiring-courses', getMyExpiringCourses);

// Personal XP & Gamification Charts (Student Only)
router.get('/my-xp-analytics', getMyXpAnalytics);

// Orders History & Payment Status
router.get('/orders', getStudentOrders as any);

// Notifications
router.get('/notifications', getNotifications);
router.put('/notifications/:id/read', markNotificationRead);

// Assignments
router.get('/assignments', getAssignments);
router.post('/assignments/submissions', submitAssignment);

// Discussions
router.get('/discussions', getDiscussionTopics);
router.post('/discussions/topics', createDiscussionTopic);
router.get('/discussions/topics/:id/replies', getDiscussionReplies);
router.post('/discussions/topics/:id/replies', createDiscussionReply);

export default router;
