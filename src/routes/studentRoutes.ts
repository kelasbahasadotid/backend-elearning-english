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
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken as any);

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
