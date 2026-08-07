import { Router } from 'express';
import { getPrompts, submitAttempt, getSpeakingAttemptsHistory, getTtsVoices, synthesizeTts, transcribeAudio } from '../controllers/speakingController';
import { uploadAudio } from '../middleware/upload';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Diagnostic & Public TTS / STT endpoints
router.post('/transcribe', uploadAudio.single('audio'), transcribeAudio);
router.get('/tts/voices', getTtsVoices);
router.post('/tts/synthesize', synthesizeTts);

// Authenticated endpoints
router.use(authenticateToken as any);

router.get('/attempts/history', getSpeakingAttemptsHistory);
router.get('/test/:testId/prompts', getPrompts);
router.post('/submit', uploadAudio.single('audio'), submitAttempt);

export default router;
