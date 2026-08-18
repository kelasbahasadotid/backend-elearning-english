import { Router as ExpressRouter } from 'express';
import {
  getAllBanners, createBanner, updateBanner, deleteBanner,
  getAllAdminCourses, getLessonsByCourse,
  createCourse, updateCourse, deleteCourse,
  createCategory, updateCategory, deleteCategory, getAllCategories,
  createModule, updateModule, deleteModule, getAllModules,
  createLesson, updateLesson, deleteLesson, getAllLessons,
  createQuiz, updateQuiz, deleteQuiz, getAllQuizzes,
  createCertificateTemplate, updateCertificateTemplate, deleteCertificateTemplate, getAllCertificateTemplates,
  
  // User Management
  getAllUsers, createUser, updateUser, deleteUser,
  
  // Quiz Questions & Options
  getQuizQuestions, createQuizQuestion, updateQuizQuestion, deleteQuizQuestion,
  createQuestionOption, updateQuestionOption, deleteQuestionOption,
  updateQuestionImage, updateQuestionOptionImage,
  
  // Lesson Content Management
  getLessonContents, getLessonContentAttachments,
  createLessonContent, updateLessonContent, deleteLessonContent,
  reorderLessonContents,
  
  // Speaking Tests & Prompts
  getAllSpeakingTests, createSpeakingTest, updateSpeakingTest, deleteSpeakingTest,
  createSpeakingPrompt, updateSpeakingPrompt, deleteSpeakingPrompt,
  
  // Order Management & Enrollments
  getAllOrders, updateOrderStatus, importScalevOrders,
  getManualPaymentProofs, verifyManualPaymentProof, directManualEnroll,
  getAllEnrollments, deleteEnrollment,

  // Settings, course status, tags, bulk users
  updateCourseStatus,
  getAllTags, createTag, updateTag, deleteTag,
  getSettings, updateSettings, getPublicSettings,
  bulkUserAction,
  getAdminAnalytics
} from '../controllers/adminController';
import { getPaymentSettings, updatePaymentSettings } from '../controllers/paymentController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = ExpressRouter();

// Public Settings route (unauthenticated)
router.get('/settings/public', getPublicSettings);

// Require logged-in user for all endpoints
router.use(authenticateToken as any);

const adminOnly = requireRole([1, 2]) as any;
const contentCreator = requireRole([1, 2, 3, 5]) as any;

import { handleManualScalevSync } from '../controllers/paymentController';
import { getScalevPackages, createScalevPackage, updateScalevPackage, deleteScalevPackage, convertPptxToPdf } from '../controllers/adminController';
import {
  getEmailSettings, saveEmailSettings, testSmtpConnection,
  getEmailMessages, createOrSendEmailMessage, updateMessageFolder, deleteEmailMessage,
  syncRoundcubeEmails
} from '../controllers/emailController';

// PPTX LibreOffice Conversion Route
router.post('/convert-pptx', contentCreator, convertPptxToPdf);

// Email Management Hub (Admin Only)
router.get('/emails/settings', adminOnly, getEmailSettings);
router.post('/emails/settings', adminOnly, saveEmailSettings);
router.post('/emails/test-smtp', adminOnly, testSmtpConnection);
router.post('/emails/sync-roundcube', adminOnly, syncRoundcubeEmails);
router.get('/emails/messages', adminOnly, getEmailMessages);
router.post('/emails/messages', adminOnly, createOrSendEmailMessage);
router.put('/emails/messages/:id/folder', adminOnly, updateMessageFolder);
router.delete('/emails/messages/:id', adminOnly, deleteEmailMessage);

// Scalev Packages Management (Admin & Content Creator)
router.get('/scalev-packages', contentCreator, getScalevPackages);
router.post('/scalev-packages', adminOnly, createScalevPackage);
router.put('/scalev-packages/:id', adminOnly, updateScalevPackage);
router.delete('/scalev-packages/:id', adminOnly, deleteScalevPackage);

// Orders & Enrollments Management (Admin Only)
router.get('/orders', adminOnly, getAllOrders);
router.put('/orders/:id/status', adminOnly, updateOrderStatus);
router.post('/orders/import-scalev', adminOnly, importScalevOrders);
router.post('/orders/scalev-sync', adminOnly, handleManualScalevSync);
router.get('/orders/manual-proofs', contentCreator, getManualPaymentProofs);
router.post('/orders/manual-proofs/:id/verify', contentCreator, verifyManualPaymentProof);
router.post('/enrollments/manual', contentCreator, directManualEnroll);
router.get('/enrollments', adminOnly, getAllEnrollments);
router.delete('/enrollments/:id', adminOnly, deleteEnrollment);

// Users Management (Admin Only)
router.get('/users', adminOnly, getAllUsers);
router.post('/users', adminOnly, createUser);
router.put('/users/:id', adminOnly, updateUser);
router.delete('/users/:id', adminOnly, deleteUser);

// Banners (Admin Only)
router.get('/banners', adminOnly, getAllBanners);
router.post('/banners', adminOnly, createBanner);
router.put('/banners/:id', adminOnly, updateBanner);
router.delete('/banners/:id', adminOnly, deleteBanner);

// Courses (Admin & Content Manager)
router.get('/courses', contentCreator, getAllAdminCourses);
router.get('/courses/:id/lessons', contentCreator, getLessonsByCourse);
router.post('/courses', contentCreator, createCourse);
router.put('/courses/:id', contentCreator, updateCourse);
router.delete('/courses/:id', contentCreator, deleteCourse);


// Categories (Admin & Content Manager)
router.get('/categories', contentCreator, getAllCategories);
router.post('/categories', contentCreator, createCategory);
router.put('/categories/:id', contentCreator, updateCategory);
router.delete('/categories/:id', contentCreator, deleteCategory);

// Modules (Admin & Content Manager)
router.get('/modules', contentCreator, getAllModules);
router.post('/modules', contentCreator, createModule);
router.put('/modules/:id', contentCreator, updateModule);
router.delete('/modules/:id', contentCreator, deleteModule);

// Lessons (Admin & Content Manager)
router.get('/lessons', contentCreator, getAllLessons);
router.post('/lessons', contentCreator, createLesson);
router.put('/lessons/:id', contentCreator, updateLesson);
router.delete('/lessons/:id', contentCreator, deleteLesson);

// Quizzes (Admin & Content Manager)
router.get('/quizzes', contentCreator, getAllQuizzes);
router.post('/quizzes', contentCreator, createQuiz);
router.put('/quizzes/:id', contentCreator, updateQuiz);
router.delete('/quizzes/:id', contentCreator, deleteQuiz);

// Quiz Questions (Admin & Content Manager)
router.get('/quizzes/:quizId/questions', contentCreator, getQuizQuestions);
router.post('/quizzes/:quizId/questions', contentCreator, createQuizQuestion);
router.put('/quizzes/questions/:questionId', contentCreator, updateQuizQuestion);
router.delete('/quizzes/questions/:questionId', contentCreator, deleteQuizQuestion);

// Quiz Question Options (Admin & Content Manager)
router.post('/quizzes/questions/:questionId/options', contentCreator, createQuestionOption);
router.put('/quizzes/questions/options/:optionId', contentCreator, updateQuestionOption);
router.delete('/quizzes/questions/options/:optionId', contentCreator, deleteQuestionOption);

// Question & Option Image Upload (base64)
router.put('/quizzes/questions/:questionId/image', contentCreator, updateQuestionImage);
router.put('/quizzes/questions/options/:optionId/image', contentCreator, updateQuestionOptionImage);

// Lesson Content Management (with base64 attachments)
router.get('/lessons/:lessonId/contents', contentCreator, getLessonContents);
router.get('/lessons/contents/:id/attachments', contentCreator, getLessonContentAttachments);
router.post('/lessons/:lessonId/contents', contentCreator, createLessonContent);
router.post('/lessons/:lessonId/contents/reorder', contentCreator, reorderLessonContents);
router.put('/lessons/contents/:id', contentCreator, updateLessonContent);
router.delete('/lessons/contents/:id', contentCreator, deleteLessonContent);

// Speaking Tests & Prompts (Admin & Content Manager)
router.get('/speaking-tests', contentCreator, getAllSpeakingTests);
router.post('/speaking-tests', contentCreator, createSpeakingTest);
router.put('/speaking-tests/:id', contentCreator, updateSpeakingTest);
router.delete('/speaking-tests/:id', contentCreator, deleteSpeakingTest);
router.post('/speaking-tests/:testId/prompts', contentCreator, createSpeakingPrompt);
router.put('/speaking-tests/prompts/:promptId', contentCreator, updateSpeakingPrompt);
router.delete('/speaking-tests/prompts/:promptId', contentCreator, deleteSpeakingPrompt);

// Certificate Templates (Admin & Content Creator)
router.get('/certificate-templates', contentCreator, getAllCertificateTemplates);
router.post('/certificate-templates', contentCreator, createCertificateTemplate);
router.put('/certificate-templates/:id', contentCreator, updateCertificateTemplate);
router.delete('/certificate-templates/:id', contentCreator, deleteCertificateTemplate);

// Settings (Admin Only)
router.get('/settings', adminOnly, getSettings);
router.put('/settings', adminOnly, updateSettings);
router.get('/payment/settings', adminOnly, getPaymentSettings as any);
router.put('/payment/settings', adminOnly, updatePaymentSettings as any);

// Course approve/reject (Content Creator)
router.put('/courses/:id/status', contentCreator, updateCourseStatus);

// Tags Taxonomy (Content Creator)
router.get('/tags', contentCreator, getAllTags);
router.post('/tags', contentCreator, createTag);
router.put('/tags/:id', contentCreator, updateTag);
router.delete('/tags/:id', contentCreator, deleteTag);

// Bulk User Actions (Admin Only)
router.post('/users/bulk-action', adminOnly, bulkUserAction);

// Analytics Monitoring (Admin Only)
router.get('/analytics', adminOnly, getAdminAnalytics);

export default router;
