"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const paymentController_1 = require("../controllers/paymentController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Public payment configuration & active methods route
router.get('/settings', paymentController_1.getPaymentSettings);
router.get('/payment/settings', paymentController_1.getPaymentSettings);
router.post('/checkout', auth_1.authenticateToken, paymentController_1.createOrder);
router.post('/orders', auth_1.authenticateToken, paymentController_1.createOrder);
router.post('/orders/checkout', auth_1.authenticateToken, paymentController_1.createOrder);
router.post('/callback', paymentController_1.processPaymentCallback);
router.post('/orders/callback', paymentController_1.processPaymentCallback);
// Manual Payment Proof Upload
router.post('/manual-proof', auth_1.authenticateToken, paymentController_1.submitManualPaymentProof);
router.post('/orders/manual-proof', auth_1.authenticateToken, paymentController_1.submitManualPaymentProof);
// Flip Payment Gateway Integration Routes
router.post('/flip/checkout', auth_1.authenticateToken, paymentController_1.createFlipPaymentLink);
router.post('/orders/flip/checkout', auth_1.authenticateToken, paymentController_1.createFlipPaymentLink);
router.post('/payment/flip/webhook', paymentController_1.handleFlipWebhook);
router.post('/flip/webhook', paymentController_1.handleFlipWebhook);
// Scalev Webhook Routes (GET/HEAD for verification ping, POST for live webhook events)
router.get('/scalev-webhook', (req, res) => {
    res.status(200).json({ status: 'active', message: 'Scalev Webhook Endpoint Ready' });
});
router.options('/scalev-webhook', (req, res) => {
    res.status(200).send('OK');
});
router.post('/scalev-webhook', paymentController_1.processScalevWebhook);
exports.default = router;
