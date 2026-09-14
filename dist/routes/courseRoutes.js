"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const courseController_1 = require("../controllers/courseController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get('/landing', courseController_1.getLandingPage);
router.get('/', courseController_1.getCourses);
router.get('/presentation/:contentId/file.pptx', courseController_1.getPresentationFile);
router.get('/attachment/:contentId/:attIdx/file', courseController_1.getAttachmentFile);
router.get('/:slug', courseController_1.getCourseDetails);
// Reviews & Announcements Actions
router.post('/:id/reviews', auth_1.authenticateToken, courseController_1.createCourseReview);
router.post('/reviews/:id/reply', auth_1.authenticateToken, (0, auth_1.requireRole)([1, 2, 3, 5]), courseController_1.replyCourseReview);
router.post('/:id/announcements', auth_1.authenticateToken, (0, auth_1.requireRole)([1, 2, 3, 5]), courseController_1.createCourseAnnouncement);
router.delete('/announcements/:id', auth_1.authenticateToken, (0, auth_1.requireRole)([1, 2, 3, 5]), courseController_1.deleteCourseAnnouncement);
exports.default = router;
