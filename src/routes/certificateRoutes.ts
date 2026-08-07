import { Router } from 'express';
import { claimCertificate, verifyCertificate } from '../controllers/certificateController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Public route - verification by scanning QR code or clicking link
router.get('/verify/:code', verifyCertificate);

router.use(authenticateToken as any);

router.post('/claim', claimCertificate);

export default router;
