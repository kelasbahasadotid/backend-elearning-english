"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const h5pController_1 = require("../controllers/h5pController");
const auth_1 = require("../middleware/auth");
const upload_1 = require("../middleware/upload");
const router = (0, express_1.Router)();
// Admin / Content Creator Middleware
const contentCreator = (0, auth_1.requireRole)([1, 2, 3, 5]);
// Admin Routes
router.get('/admin/h5p', auth_1.authenticateToken, contentCreator, h5pController_1.getAllH5P);
router.get('/admin/h5p/:id', auth_1.authenticateToken, contentCreator, h5pController_1.getH5PById);
router.post('/admin/h5p', auth_1.authenticateToken, contentCreator, h5pController_1.createH5P);
router.post('/admin/h5p/upload-media', auth_1.authenticateToken, contentCreator, upload_1.uploadMedia.single('file'), h5pController_1.uploadH5PMedia);
router.put('/admin/h5p/:id', auth_1.authenticateToken, contentCreator, h5pController_1.updateH5P);
router.delete('/admin/h5p/:id', auth_1.authenticateToken, contentCreator, h5pController_1.deleteH5P);
router.post('/admin/h5p/:id/attach', auth_1.authenticateToken, contentCreator, h5pController_1.attachH5PToLesson);
// Public / Student View & Interactive Submission Routes
router.get('/students/h5p/:id', auth_1.authenticateToken, h5pController_1.getH5PById);
router.post('/students/h5p/:id/submit', auth_1.authenticateToken, h5pController_1.submitH5PAttempt);
exports.default = router;
