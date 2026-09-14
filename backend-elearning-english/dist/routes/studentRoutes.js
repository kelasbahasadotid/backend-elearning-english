"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const studentController_1 = require("../controllers/studentController");
const paymentController_1 = require("../controllers/paymentController");
const studyController_1 = require("../controllers/studyController");
const enrollmentExpiryController_1 = require("../controllers/enrollmentExpiryController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
// Course Expiration & Renewal Alerts
router.get('/expiring-courses', enrollmentExpiryController_1.getMyExpiringCourses);
// Personal XP & Gamification Charts (Student Only)
router.get('/my-xp-analytics', studyController_1.getMyXpAnalytics);
// Orders History & Payment Status
router.get('/orders', paymentController_1.getStudentOrders);
// Notifications
router.get('/notifications', studentController_1.getNotifications);
router.put('/notifications/:id/read', studentController_1.markNotificationRead);
// Assignments
router.get('/assignments', studentController_1.getAssignments);
router.post('/assignments/submissions', studentController_1.submitAssignment);
// Discussions
router.get('/discussions', studentController_1.getDiscussionTopics);
router.post('/discussions/topics', studentController_1.createDiscussionTopic);
router.get('/discussions/topics/:id/replies', studentController_1.getDiscussionReplies);
router.post('/discussions/topics/:id/replies', studentController_1.createDiscussionReply);
exports.default = router;
