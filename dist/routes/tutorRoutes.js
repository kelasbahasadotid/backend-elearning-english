"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const tutorController_1 = require("../controllers/tutorController");
const adminController_1 = require("../controllers/adminController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Require logged-in user and administrative/tutor roles (SUPER_ADMIN=1, ADMIN=2, TUTOR=3)
router.use(auth_1.authenticateToken);
router.use((0, auth_1.requireRole)([1, 2, 3]));
// Tutor Submissions & Reviews
router.get('/submissions', tutorController_1.getStudentSubmissions);
router.post('/submissions/:attemptId/review', tutorController_1.submitTutorReview);
// Tutor Lesson Management
router.get('/lessons', adminController_1.getAllLessons);
router.get('/courses/:id/lessons', adminController_1.getLessonsByCourse);
router.post('/lessons', adminController_1.createLesson);
router.put('/lessons/:id', adminController_1.updateLesson);
router.delete('/lessons/:id', adminController_1.deleteLesson);
// Tutor Lesson Contents Management
router.get('/lessons/:lessonId/contents', adminController_1.getLessonContents);
router.get('/lessons/contents/:id/attachments', adminController_1.getLessonContentAttachments);
router.post('/lessons/:lessonId/contents', adminController_1.createLessonContent);
router.post('/lessons/:lessonId/contents/reorder', adminController_1.reorderLessonContents);
router.put('/lessons/contents/:id', adminController_1.updateLessonContent);
router.delete('/lessons/contents/:id', adminController_1.deleteLessonContent);
// Tutor Quizzes Management
router.get('/quizzes', adminController_1.getAllQuizzes);
router.post('/quizzes', adminController_1.createQuiz);
router.put('/quizzes/:id', adminController_1.updateQuiz);
router.delete('/quizzes/:id', adminController_1.deleteQuiz);
// Tutor Quiz Questions & Matching Pairs Management
router.get('/quizzes/:quizId/questions', adminController_1.getQuizQuestions);
router.post('/quizzes/:quizId/questions', adminController_1.createQuizQuestion);
router.put('/quizzes/questions/:questionId', adminController_1.updateQuizQuestion);
router.delete('/quizzes/questions/:questionId', adminController_1.deleteQuizQuestion);
// Tutor Question Options & Bulk Matching Pairs
router.post('/quizzes/questions/:questionId/options', adminController_1.createQuestionOption);
router.post('/quizzes/questions/:questionId/options/bulk', adminController_1.bulkSetQuestionOptions);
router.post('/quizzes/questions/:questionId/matching-pairs', adminController_1.bulkSetMatchingPairs);
router.put('/quizzes/questions/options/:optionId', adminController_1.updateQuestionOption);
router.delete('/quizzes/questions/options/:optionId', adminController_1.deleteQuestionOption);
// Images
router.put('/quizzes/questions/:questionId/image', adminController_1.updateQuestionImage);
router.put('/quizzes/questions/options/:optionId/image', adminController_1.updateQuestionOptionImage);
exports.default = router;
