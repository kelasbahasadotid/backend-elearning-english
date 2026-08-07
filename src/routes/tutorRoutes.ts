import { Router as ExpressRouter } from 'express';
import { getStudentSubmissions, submitTutorReview } from '../controllers/tutorController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = ExpressRouter();

// Require logged-in user and administrative/tutor roles (SUPER_ADMIN=1, ADMIN=2, TUTOR=3)
router.use(authenticateToken as any);
router.use(requireRole([1, 2, 3]) as any);

router.get('/submissions', getStudentSubmissions);
router.post('/submissions/:attemptId/review', submitTutorReview);

export default router;
