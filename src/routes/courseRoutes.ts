import { Router } from 'express';
import { 
  getLandingPage, getCourses, getCourseDetails,
  createCourseReview, replyCourseReview, createCourseAnnouncement, deleteCourseAnnouncement,
  getPresentationFile, getAttachmentFile
} from '../controllers/courseController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

router.get('/landing', getLandingPage);
router.get('/', getCourses);
router.get('/presentation/:contentId/file.pptx', getPresentationFile);
router.get('/attachment/:contentId/:attIdx/file', getAttachmentFile);
router.get('/:slug', getCourseDetails);

// Reviews & Announcements Actions
router.post('/:id/reviews', authenticateToken as any, createCourseReview);
router.post('/reviews/:id/reply', authenticateToken as any, requireRole([1, 2, 3, 5]) as any, replyCourseReview);
router.post('/:id/announcements', authenticateToken as any, requireRole([1, 2, 3, 5]) as any, createCourseAnnouncement);
router.delete('/announcements/:id', authenticateToken as any, requireRole([1, 2, 3, 5]) as any, deleteCourseAnnouncement);

export default router;
