import { Router as ExpressRouter } from 'express';
import {
  getAllH5P,
  getH5PById,
  createH5P,
  updateH5P,
  deleteH5P,
  attachH5PToLesson,
  submitH5PAttempt,
  uploadH5PMedia
} from '../controllers/h5pController';
import { authenticateToken, requireRole } from '../middleware/auth';
import { uploadMedia } from '../middleware/upload';

const router = ExpressRouter();

// Admin / Content Creator Middleware
const contentCreator = requireRole([1, 2, 5]) as any;

// Admin Routes
router.get('/admin/h5p', authenticateToken as any, contentCreator, getAllH5P);
router.get('/admin/h5p/:id', authenticateToken as any, contentCreator, getH5PById);
router.post('/admin/h5p', authenticateToken as any, contentCreator, createH5P);
router.post('/admin/h5p/upload-media', authenticateToken as any, contentCreator, uploadMedia.single('file'), uploadH5PMedia);
router.put('/admin/h5p/:id', authenticateToken as any, contentCreator, updateH5P);
router.delete('/admin/h5p/:id', authenticateToken as any, contentCreator, deleteH5P);
router.post('/admin/h5p/:id/attach', authenticateToken as any, contentCreator, attachH5PToLesson);

// Public / Student View & Interactive Submission Routes
router.get('/students/h5p/:id', authenticateToken as any, getH5PById);
router.post('/students/h5p/:id/submit', authenticateToken as any, submitH5PAttempt);

export default router;
