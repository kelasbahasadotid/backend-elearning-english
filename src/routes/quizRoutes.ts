import { Router } from 'express';
import { getQuiz, submitAttempt, getAttemptHistory, getAttemptDetails, getAssessmentsByType, checkSingleQuestion } from '../controllers/quizController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken as any);

router.get('/type/:typeCode', getAssessmentsByType);
router.get('/attempts/history', getAttemptHistory);
router.get('/attempts/:attemptId', getAttemptDetails);
router.post('/check-question', checkSingleQuestion);
router.post('/:id/check-question', checkSingleQuestion);
router.get('/:id', getQuiz);
router.post('/submit', submitAttempt);

export default router;

