import { Router } from 'express';
import { createOrder, processPaymentCallback, processScalevWebhook } from '../controllers/paymentController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.post('/checkout', authenticateToken as any, createOrder);
router.post('/orders', authenticateToken as any, createOrder);
router.post('/callback', processPaymentCallback);

// Scalev Webhook Routes (GET/HEAD for verification ping, POST for live webhook events)
router.get('/scalev-webhook', (req, res) => {
  res.status(200).json({ status: 'active', message: 'Scalev Webhook Endpoint Ready' });
});
router.options('/scalev-webhook', (req, res) => {
  res.status(200).send('OK');
});
router.post('/scalev-webhook', processScalevWebhook);

export default router;
