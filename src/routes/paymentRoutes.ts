import { Router } from 'express';
import {
  createOrder,
  processPaymentCallback,
  processScalevWebhook,
  submitManualPaymentProof,
  createFlipPaymentLink,
  handleFlipWebhook,
  getPaymentSettings
} from '../controllers/paymentController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Public payment configuration & active methods route
router.get('/settings', getPaymentSettings as any);
router.get('/payment/settings', getPaymentSettings as any);

router.post('/checkout', authenticateToken as any, createOrder as any);
router.post('/orders', authenticateToken as any, createOrder as any);
router.post('/orders/checkout', authenticateToken as any, createOrder as any);
router.post('/callback', processPaymentCallback as any);
router.post('/orders/callback', processPaymentCallback as any);

// Manual Payment Proof Upload
router.post('/manual-proof', authenticateToken as any, submitManualPaymentProof as any);
router.post('/orders/manual-proof', authenticateToken as any, submitManualPaymentProof as any);

// Flip Payment Gateway Integration Routes
router.post('/flip/checkout', authenticateToken as any, createFlipPaymentLink as any);
router.post('/orders/flip/checkout', authenticateToken as any, createFlipPaymentLink as any);
router.post('/payment/flip/webhook', handleFlipWebhook as any);
router.post('/flip/webhook', handleFlipWebhook as any);

// Scalev Webhook Routes (GET/HEAD for verification ping, POST for live webhook events)
router.get('/scalev-webhook', (req, res) => {
  res.status(200).json({ status: 'active', message: 'Scalev Webhook Endpoint Ready' });
});
router.options('/scalev-webhook', (req, res) => {
  res.status(200).send('OK');
});
router.post('/scalev-webhook', processScalevWebhook);

export default router;
