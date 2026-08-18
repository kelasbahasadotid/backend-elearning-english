import { Router } from 'express';
import {
  getMediaList,
  uploadMediaFile,
  addMediaLink,
  generateAiAudio,
  generateAiDialogue,
  synthesizeMediaPreview,
  updateMedia,
  deleteMedia,
  getSpeakingTargets
} from '../controllers/mediaController';
import { authenticateToken, requireRole } from '../middleware/auth';
import { uploadLibraryMedia } from '../middleware/upload';

const router = Router();

// Protect media endpoints: Admin (1, 2), Tutor (3), Content Manager (5)
router.use(authenticateToken);
router.use(requireRole([1, 2, 3, 5]));

// Media Library CRUD & Generator
router.get('/', getMediaList);
router.get('/target-lessons', getSpeakingTargets);
router.get('/speaking-targets', getSpeakingTargets);
router.post('/upload', uploadLibraryMedia.single('file'), uploadMediaFile);
router.post('/link', addMediaLink);
router.post('/generate-ai-audio', generateAiAudio);
router.post('/generate-ai-dialogue', generateAiDialogue);
router.post('/synthesize-preview', synthesizeMediaPreview);
router.put('/:id', updateMedia);
router.delete('/:id', deleteMedia);

export default router;

