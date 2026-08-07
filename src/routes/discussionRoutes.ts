import { Router } from 'express';
import {
  createDiscussion,
  addComment,
  listDiscussions,
  listComments,
  deleteDiscussion,
  deleteComment,
} from '../controllers/discussionController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.post('/', authenticateToken, createDiscussion);
router.get('/', listDiscussions);
router.post('/comment', authenticateToken, addComment);
router.get('/comments', listComments);
router.delete('/:id', authenticateToken, deleteDiscussion);
router.delete('/comment/:id', authenticateToken, deleteComment);

export default router;
