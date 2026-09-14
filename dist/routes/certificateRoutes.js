"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const certificateController_1 = require("../controllers/certificateController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Public route - verification by scanning QR code or clicking link
router.get('/verify/:code', certificateController_1.verifyCertificate);
router.use(auth_1.authenticateToken);
router.post('/claim', certificateController_1.claimCertificate);
exports.default = router;
