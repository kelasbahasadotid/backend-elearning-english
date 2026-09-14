"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const taskController_1 = require("../controllers/taskController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Student: pending tasks summary
router.get('/pending-summary', auth_1.authenticateToken, taskController_1.getPendingTasksSummary);
// Admin: CRUD assignments
router.post('/', auth_1.authenticateToken, taskController_1.createTask);
router.get('/', auth_1.authenticateToken, taskController_1.listTasks);
router.put('/:id', auth_1.authenticateToken, taskController_1.updateTask);
router.delete('/:id', auth_1.authenticateToken, taskController_1.deleteTask);
// Student: submit
router.post('/:id/submit', auth_1.authenticateToken, taskController_1.submitTaskAnswer);
// Admin: grade & view submissions
router.get('/:id/submissions', auth_1.authenticateToken, taskController_1.listTaskSubmissions);
router.put('/submission/:id/grade', auth_1.authenticateToken, taskController_1.gradeSubmission);
// Backward compat
router.post('/assign', auth_1.authenticateToken, taskController_1.assignTask);
router.put('/:id/status', auth_1.authenticateToken, taskController_1.updateTaskStatus);
exports.default = router;
