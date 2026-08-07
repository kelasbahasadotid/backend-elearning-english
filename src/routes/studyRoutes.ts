import { Router } from 'express';
import { getLesson, updateVideoProgress, updateLessonProgress, toggleBookmark, getBookmarkedLessons, getLeaderboard } from '../controllers/studyController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken as any);

router.get('/leaderboard', getLeaderboard);
router.get('/lesson/:id', getLesson);
router.post('/video-progress', updateVideoProgress);
router.post('/progress', updateLessonProgress);
router.post('/lesson/:id/bookmark', toggleBookmark);
router.get('/bookmarks', getBookmarkedLessons);

export default router;
