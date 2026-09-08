import { Router } from 'express';
import {
  getLesson,
  updateVideoProgress,
  updateLessonProgress,
  toggleBookmark,
  getBookmarkedLessons,
  getLeaderboard,
  getActiveSeasonInfo,
  getPublicLevels,
  getMySeasonHistory,
  getPastSeasonLeaderboard,
  getMyProgressSummary
} from '../controllers/studyController';
import { authenticateToken } from '../middleware/auth';

import {
  getMyVocabularyRoom,
  getVocabularyDetails,
  checkVocabularyDuplicate,
  createManualVocabulary,
  updateVocabulary,
  deleteVocabulary
} from '../controllers/vocabularyController';

const router = Router();

router.use(authenticateToken as any);

// Room Vocabulary (Personal Student Dictionary)
router.get('/vocabulary', getMyVocabularyRoom);
router.post('/vocabulary/check', checkVocabularyDuplicate);
router.get('/vocabulary/:id', getVocabularyDetails);
router.post('/vocabulary', createManualVocabulary);
router.put('/vocabulary/:id', updateVocabulary);
router.delete('/vocabulary/:id', deleteVocabulary);

router.get('/leaderboard', getLeaderboard);
router.get('/season/current', getActiveSeasonInfo);
router.get('/seasons/my-history', getMySeasonHistory);
router.get('/seasons/:id/leaderboard', getPastSeasonLeaderboard);
router.get('/levels', getPublicLevels);

router.get('/my-progress', getMyProgressSummary);
router.get('/lesson/:id', getLesson);
router.post('/video-progress', updateVideoProgress);
router.post('/progress', updateLessonProgress);
router.post('/lesson/:id/bookmark', toggleBookmark);
router.get('/bookmarks', getBookmarkedLessons);

export default router;


