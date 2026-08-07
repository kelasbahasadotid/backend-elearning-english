import { Router } from 'express';
import {
  createTask,
  listTasks,
  updateTask,
  deleteTask,
  submitTaskAnswer,
  gradeSubmission,
  listTaskSubmissions,
  getPendingTasksSummary,
  assignTask,
  updateTaskStatus,
} from '../controllers/taskController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Student: pending tasks summary
router.get('/pending-summary', authenticateToken, getPendingTasksSummary);

// Admin: CRUD assignments
router.post('/', authenticateToken, createTask);
router.get('/', authenticateToken, listTasks);
router.put('/:id', authenticateToken, updateTask);
router.delete('/:id', authenticateToken, deleteTask);

// Student: submit
router.post('/:id/submit', authenticateToken, submitTaskAnswer);

// Admin: grade & view submissions
router.get('/:id/submissions', authenticateToken, listTaskSubmissions);
router.put('/submission/:id/grade', authenticateToken, gradeSubmission);

// Backward compat
router.post('/assign', authenticateToken, assignTask);
router.put('/:id/status', authenticateToken, updateTaskStatus);

export default router;
