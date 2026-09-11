import { Router } from 'express';
import {
  getMyConversation,
  sendStudentMessage,
  markMyChatRead
} from '../controllers/chatController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken as any);

// Student Chat Routes
router.get('/my-conversation', getMyConversation);
router.post('/messages', sendStudentMessage);
router.put('/read', markMyChatRead);

export default router;
