"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const adminController_1 = require("../controllers/adminController");
const paymentController_1 = require("../controllers/paymentController");
const auth_1 = require("../middleware/auth");
const upload_1 = require("../middleware/upload");
const router = (0, express_1.Router)();
// Public Settings route (unauthenticated)
router.get('/settings/public', adminController_1.getPublicSettings);
// Require logged-in user for all endpoints
router.use(auth_1.authenticateToken);
const adminOnly = (0, auth_1.requireRole)([1, 2]);
const contentCreator = (0, auth_1.requireRole)([1, 2, 3, 5]);
const paymentController_2 = require("../controllers/paymentController");
const adminController_2 = require("../controllers/adminController");
const emailController_1 = require("../controllers/emailController");
const seasonAdminController_1 = require("../controllers/seasonAdminController");
const levelAdminController_1 = require("../controllers/levelAdminController");
const vocabularyController_1 = require("../controllers/vocabularyController");
const gamificationAdminController_1 = require("../controllers/gamificationAdminController");
const enrollmentExpiryController_1 = require("../controllers/enrollmentExpiryController");
const chatController_1 = require("../controllers/chatController");
// PPTX LibreOffice Conversion Route
router.post('/convert-pptx', contentCreator, adminController_2.convertPptxToPdf);
// Email Management Hub (Admin Only)
router.get('/emails/settings', adminOnly, emailController_1.getEmailSettings);
router.post('/emails/settings', adminOnly, emailController_1.saveEmailSettings);
router.post('/emails/test-smtp', adminOnly, emailController_1.testSmtpConnection);
router.post('/emails/sync-roundcube', adminOnly, emailController_1.syncRoundcubeEmails);
router.get('/emails/messages', adminOnly, emailController_1.getEmailMessages);
router.post('/emails/messages', adminOnly, emailController_1.createOrSendEmailMessage);
router.put('/emails/messages/:id/folder', adminOnly, emailController_1.updateMessageFolder);
router.delete('/emails/messages/:id', adminOnly, emailController_1.deleteEmailMessage);
// Scalev Packages Management (Admin & Content Creator)
router.get('/scalev-packages', contentCreator, adminController_2.getScalevPackages);
router.post('/scalev-packages', adminOnly, adminController_2.createScalevPackage);
router.put('/scalev-packages/:id', adminOnly, adminController_2.updateScalevPackage);
router.delete('/scalev-packages/:id', adminOnly, adminController_2.deleteScalevPackage);
// Orders & Enrollments Management (Admin Only)
router.get('/orders', adminOnly, adminController_1.getAllOrders);
router.put('/orders/:id/status', adminOnly, adminController_1.updateOrderStatus);
router.post('/orders/import-scalev', adminOnly, adminController_1.importScalevOrders);
router.post('/orders/scalev-sync', adminOnly, paymentController_2.handleManualScalevSync);
router.get('/orders/manual-proofs', contentCreator, adminController_1.getManualPaymentProofs);
router.post('/orders/manual-proofs/:id/verify', contentCreator, adminController_1.verifyManualPaymentProof);
router.post('/enrollments/manual', contentCreator, adminController_1.directManualEnroll);
router.get('/enrollments', adminOnly, adminController_1.getAllEnrollments);
router.get('/enrollments/expiring', adminOnly, enrollmentExpiryController_1.getExpiringEnrollmentsAdmin);
router.post('/enrollments/check-expiries', adminOnly, enrollmentExpiryController_1.triggerManualExpiryCheck);
router.delete('/enrollments/:id', adminOnly, adminController_1.deleteEnrollment);
// Realtime Chat Management (Admin Only)
router.get('/chat/conversations', adminOnly, chatController_1.getAdminConversationsList);
router.get('/chat/conversations/:studentId/messages', adminOnly, chatController_1.getStudentConversationAdmin);
router.post('/chat/conversations/:studentId/messages', adminOnly, chatController_1.sendAdminMessage);
router.put('/chat/conversations/:studentId/read', adminOnly, chatController_1.markAdminChatRead);
// Users Management (Admin Only)
router.get('/users', adminOnly, adminController_1.getAllUsers);
router.post('/users', adminOnly, adminController_1.createUser);
router.put('/users/:id', adminOnly, adminController_1.updateUser);
router.delete('/users/:id', adminOnly, adminController_1.deleteUser);
router.get('/users/:id/progress-summary', adminOnly, adminController_1.getUserProgressSummary);
router.post('/users/:id/reset-progress', adminOnly, adminController_1.resetUserLessonProgress);
// Banners (Admin Only)
router.get('/banners', adminOnly, adminController_1.getAllBanners);
router.post('/banners', adminOnly, adminController_1.createBanner);
router.put('/banners/:id', adminOnly, adminController_1.updateBanner);
router.delete('/banners/:id', adminOnly, adminController_1.deleteBanner);
// Courses (Admin & Content Manager)
router.get('/courses', contentCreator, adminController_1.getAllAdminCourses);
router.get('/courses/:id/lessons', contentCreator, adminController_1.getLessonsByCourse);
router.post('/courses', contentCreator, adminController_1.createCourse);
router.put('/courses/:id', contentCreator, adminController_1.updateCourse);
router.delete('/courses/:id', contentCreator, adminController_1.deleteCourse);
// Categories (Admin & Content Manager)
router.get('/categories', contentCreator, adminController_1.getAllCategories);
router.post('/categories', contentCreator, adminController_1.createCategory);
router.put('/categories/:id', contentCreator, adminController_1.updateCategory);
router.delete('/categories/:id', contentCreator, adminController_1.deleteCategory);
// Units (Admin & Content Manager)
router.get('/units', contentCreator, adminController_1.getAllUnits);
router.post('/units', contentCreator, adminController_1.createUnit);
router.post('/units/reorder', contentCreator, adminController_1.reorderUnits);
router.put('/units/:id', contentCreator, adminController_1.updateUnit);
router.delete('/units/:id', contentCreator, adminController_1.deleteUnit);
// Modules (Admin & Content Manager)
router.get('/modules', contentCreator, adminController_1.getAllModules);
router.post('/modules', contentCreator, adminController_1.createModule);
router.put('/modules/:id', contentCreator, adminController_1.updateModule);
router.put('/modules/:id/move-unit', contentCreator, adminController_1.moveModuleUnit);
router.delete('/modules/:id', contentCreator, adminController_1.deleteModule);
// Lessons (Admin & Content Manager)
router.get('/lessons', contentCreator, adminController_1.getAllLessons);
router.post('/lessons', contentCreator, adminController_1.createLesson);
router.put('/lessons/:id', contentCreator, adminController_1.updateLesson);
router.delete('/lessons/:id', contentCreator, adminController_1.deleteLesson);
// Quizzes (Admin & Content Manager)
router.get('/quizzes', contentCreator, adminController_1.getAllQuizzes);
router.post('/quizzes', contentCreator, adminController_1.createQuiz);
router.put('/quizzes/:id', contentCreator, adminController_1.updateQuiz);
router.delete('/quizzes/:id', contentCreator, adminController_1.deleteQuiz);
// Quiz Questions (Admin & Content Manager)
router.get('/quizzes/template/download', contentCreator, adminController_1.downloadQuizTemplate);
router.post('/quizzes/:quizId/import', contentCreator, upload_1.uploadMemory.single('file'), adminController_1.importQuizQuestions);
router.get('/quizzes/:quizId/questions', contentCreator, adminController_1.getQuizQuestions);
router.post('/quizzes/:quizId/questions', contentCreator, adminController_1.createQuizQuestion);
router.put('/quizzes/questions/:questionId', contentCreator, adminController_1.updateQuizQuestion);
router.delete('/quizzes/questions/:questionId', contentCreator, adminController_1.deleteQuizQuestion);
// Quiz Question Options & Matching Pairs (Admin & Content Manager)
router.post('/quizzes/questions/:questionId/options', contentCreator, adminController_1.createQuestionOption);
router.post('/quizzes/questions/:questionId/options/bulk', contentCreator, adminController_1.bulkSetQuestionOptions);
router.post('/quizzes/questions/:questionId/matching-pairs', contentCreator, adminController_1.bulkSetMatchingPairs);
router.put('/quizzes/questions/options/:optionId', contentCreator, adminController_1.updateQuestionOption);
router.delete('/quizzes/questions/options/:optionId', contentCreator, adminController_1.deleteQuestionOption);
// Question & Option Image Upload (base64)
router.put('/quizzes/questions/:questionId/image', contentCreator, adminController_1.updateQuestionImage);
router.put('/quizzes/questions/options/:optionId/image', contentCreator, adminController_1.updateQuestionOptionImage);
// Lesson Content Management (with base64 attachments)
router.get('/lessons/:lessonId/contents', contentCreator, adminController_1.getLessonContents);
router.get('/lessons/contents/:id/attachments', contentCreator, adminController_1.getLessonContentAttachments);
router.post('/lessons/:lessonId/contents', contentCreator, adminController_1.createLessonContent);
router.post('/lessons/:lessonId/contents/reorder', contentCreator, adminController_1.reorderLessonContents);
router.put('/lessons/contents/:id', contentCreator, adminController_1.updateLessonContent);
router.delete('/lessons/contents/:id', contentCreator, adminController_1.deleteLessonContent);
// Speaking Tests & Prompts (Admin & Content Manager)
router.get('/speaking-tests', contentCreator, adminController_1.getAllSpeakingTests);
router.post('/speaking-tests', contentCreator, adminController_1.createSpeakingTest);
router.put('/speaking-tests/:id', contentCreator, adminController_1.updateSpeakingTest);
router.delete('/speaking-tests/:id', contentCreator, adminController_1.deleteSpeakingTest);
router.post('/speaking-tests/:testId/prompts', contentCreator, adminController_1.createSpeakingPrompt);
router.put('/speaking-tests/prompts/:promptId', contentCreator, adminController_1.updateSpeakingPrompt);
router.delete('/speaking-tests/prompts/:promptId', contentCreator, adminController_1.deleteSpeakingPrompt);
// Certificate Templates (Admin & Content Creator)
router.get('/certificate-templates', contentCreator, adminController_1.getAllCertificateTemplates);
router.post('/certificate-templates', contentCreator, adminController_1.createCertificateTemplate);
router.put('/certificate-templates/:id', contentCreator, adminController_1.updateCertificateTemplate);
router.delete('/certificate-templates/:id', contentCreator, adminController_1.deleteCertificateTemplate);
// Settings (Admin Only)
router.get('/settings', adminOnly, adminController_1.getSettings);
router.put('/settings', adminOnly, adminController_1.updateSettings);
router.get('/payment/settings', adminOnly, paymentController_1.getPaymentSettings);
router.put('/payment/settings', adminOnly, paymentController_1.updatePaymentSettings);
// Course approve/reject (Content Creator)
router.put('/courses/:id/status', contentCreator, adminController_1.updateCourseStatus);
// Tags Taxonomy (Content Creator)
router.get('/tags', contentCreator, adminController_1.getAllTags);
router.post('/tags', contentCreator, adminController_1.createTag);
router.put('/tags/:id', contentCreator, adminController_1.updateTag);
router.delete('/tags/:id', contentCreator, adminController_1.deleteTag);
// Bulk User Actions (Admin Only)
router.post('/users/bulk-action', adminOnly, adminController_1.bulkUserAction);
// Analytics Monitoring (Admin Only)
router.get('/analytics', adminOnly, adminController_1.getAdminAnalytics);
// Gamification: Leaderboard Seasons Management & Reset (Admin Only)
router.get('/seasons', adminOnly, seasonAdminController_1.getSeasons);
router.get('/seasons/current', adminOnly, seasonAdminController_1.getCurrentSeason);
router.put('/seasons/schedule', adminOnly, seasonAdminController_1.updateActiveSeasonSchedule);
router.post('/seasons/reset', adminOnly, seasonAdminController_1.manualResetSeason);
router.get('/seasons/:id/history', adminOnly, seasonAdminController_1.getSeasonHistory);
router.get('/seasons/student/:userId', adminOnly, seasonAdminController_1.getStudentSeasonHistoryAdmin);
// Gamification: Levels Progression & Naming (Admin Only)
router.get('/levels', adminOnly, levelAdminController_1.getLevels);
router.post('/levels', adminOnly, levelAdminController_1.createLevel);
router.put('/levels/:id', adminOnly, levelAdminController_1.updateLevel);
router.delete('/levels/:id', adminOnly, levelAdminController_1.deleteLevel);
router.post('/levels/bulk', adminOnly, levelAdminController_1.bulkUpdateLevels);
// Student Vocabulary Room Monitoring (Admin Only)
router.get('/vocabulary/student/:userId', adminOnly, vocabularyController_1.getStudentVocabularyAdmin);
// Gamification: Leaderboard Charts & Student XP Analytics (Admin Only)
router.get('/leaderboard/analytics', adminOnly, gamificationAdminController_1.getLeaderboardChartAnalytics);
router.get('/students/xp-stats', adminOnly, gamificationAdminController_1.getStudentsXpAnalytics);
router.get('/students/:userId/xp-history', adminOnly, gamificationAdminController_1.getStudentXpDetailHistory);
exports.default = router;
