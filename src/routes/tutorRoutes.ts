import { Router as ExpressRouter } from 'express';
import { getStudentSubmissions, submitTutorReview } from '../controllers/tutorController';
import {
  getAllLessons, getLessonsByCourse, createLesson, updateLesson, deleteLesson,
  getLessonContents, getLessonContentAttachments, createLessonContent, updateLessonContent, deleteLessonContent, reorderLessonContents,
  getAllQuizzes, createQuiz, updateQuiz, deleteQuiz,
  getQuizQuestions, createQuizQuestion, updateQuizQuestion, deleteQuizQuestion,
  createQuestionOption, updateQuestionOption, deleteQuestionOption,
  bulkSetMatchingPairs, bulkSetQuestionOptions,
  updateQuestionImage, updateQuestionOptionImage
} from '../controllers/adminController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = ExpressRouter();

// Require logged-in user and administrative/tutor roles (SUPER_ADMIN=1, ADMIN=2, TUTOR=3)
router.use(authenticateToken as any);
router.use(requireRole([1, 2, 3]) as any);

// Tutor Submissions & Reviews
router.get('/submissions', getStudentSubmissions);
router.post('/submissions/:attemptId/review', submitTutorReview);

// Tutor Lesson Management
router.get('/lessons', getAllLessons);
router.get('/courses/:id/lessons', getLessonsByCourse);
router.post('/lessons', createLesson);
router.put('/lessons/:id', updateLesson);
router.delete('/lessons/:id', deleteLesson);

// Tutor Lesson Contents Management
router.get('/lessons/:lessonId/contents', getLessonContents);
router.get('/lessons/contents/:id/attachments', getLessonContentAttachments);
router.post('/lessons/:lessonId/contents', createLessonContent);
router.post('/lessons/:lessonId/contents/reorder', reorderLessonContents);
router.put('/lessons/contents/:id', updateLessonContent);
router.delete('/lessons/contents/:id', deleteLessonContent);

// Tutor Quizzes Management
router.get('/quizzes', getAllQuizzes);
router.post('/quizzes', createQuiz);
router.put('/quizzes/:id', updateQuiz);
router.delete('/quizzes/:id', deleteQuiz);

// Tutor Quiz Questions & Matching Pairs Management
router.get('/quizzes/:quizId/questions', getQuizQuestions);
router.post('/quizzes/:quizId/questions', createQuizQuestion);
router.put('/quizzes/questions/:questionId', updateQuizQuestion);
router.delete('/quizzes/questions/:questionId', deleteQuizQuestion);

// Tutor Question Options & Bulk Matching Pairs
router.post('/quizzes/questions/:questionId/options', createQuestionOption);
router.post('/quizzes/questions/:questionId/options/bulk', bulkSetQuestionOptions);
router.post('/quizzes/questions/:questionId/matching-pairs', bulkSetMatchingPairs);
router.put('/quizzes/questions/options/:optionId', updateQuestionOption);
router.delete('/quizzes/questions/options/:optionId', deleteQuestionOption);

// Images
router.put('/quizzes/questions/:questionId/image', updateQuestionImage);
router.put('/quizzes/questions/options/:optionId/image', updateQuestionOptionImage);

export default router;
