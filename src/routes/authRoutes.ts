import { Router } from 'express';
import { register, verifyCode, resendCode, login, getProfile, updateProfile, forgotPassword, socialLogin, completeOnboarding } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.post('/register', register);
router.post('/verify-code', verifyCode);
router.post('/resend-code', resendCode);
router.post('/login', login);
router.post('/social-login', socialLogin);
router.post('/complete-onboarding', authenticateToken as any, completeOnboarding);
router.post('/forgot-password', forgotPassword);
router.get('/profile', authenticateToken as any, getProfile);
router.put('/profile', authenticateToken as any, updateProfile);

export default router;
