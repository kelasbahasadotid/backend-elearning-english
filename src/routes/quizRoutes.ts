import { Router } from 'express';
import { getQuiz, submitAttempt, getAttemptHistory, getAttemptDetails, getAssessmentsByType } from '../controllers/quizController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken as any);

router.get('/type/:typeCode', getAssessmentsByType);
router.get('/attempts/history', getAttemptHistory);
router.get('/attempts/:attemptId', getAttemptDetails);
router.get('/:id', getQuiz);
router.post('/submit', submitAttempt);

export default router;
