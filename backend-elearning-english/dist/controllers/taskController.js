"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateTaskStatus = exports.assignTask = exports.createTask_stub = exports.listTaskSubmissions = exports.gradeSubmission = exports.submitTaskAnswer = exports.deleteTask = exports.updateTask = exports.listTasks = exports.getPendingTasksSummary = exports.createTask = void 0;
const db_1 = __importDefault(require("../config/db"));
// ─── CREATE ASSIGNMENT (Admin/Super Admin) ─────────────────────────────────
const createTask = async (req, res) => {
    const authReq = req;
    const adminId = authReq.user?.id;
    let { course_id, lesson_id, title, description, due_date, max_points } = req.body;
    if (!adminId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    if (!course_id || !title) {
        res.status(400).json({ error: 'course_id and title are required' });
        return;
    }
    try {
        if (isNaN(Number(course_id)) && course_id) {
            const [cRows] = await db_1.default.query('SELECT id FROM courses WHERE slug = ? OR id = ?', [course_id, course_id]);
            if (cRows.length > 0)
                course_id = cRows[0].id;
        }
        const [result] = await db_1.default.query(`INSERT INTO assignments (course_id, lesson_id, title, description, due_date, max_points)
       VALUES (?, ?, ?, ?, ?, ?)`, [course_id, lesson_id || null, title, description || '', due_date || null, max_points || 100]);
        const taskId = result.insertId;
        // Notify all enrolled students in the course, or all student users if no specific enrollments exist
        let [students] = await db_1.default.query(`SELECT DISTINCT user_id FROM enrollments WHERE course_id = ?`, [course_id]);
        if (students.length === 0) {
            [students] = await db_1.default.query(`SELECT id AS user_id FROM users WHERE role_id IN (3, 4)`);
        }
        for (const student of students) {
            await db_1.default.query(`INSERT INTO user_notifications (user_id, assignment_id, title, message, is_read) VALUES (?, ?, ?, ?, 0)`, [student.user_id, taskId, 'Tugas Baru Tersedia', `Tugas baru "${title}" telah ditambahkan di kursus Anda.`]);
        }
        res.status(201).json({ message: 'Task created', taskId });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
};
exports.createTask = createTask;
// ─── GET PENDING TASKS SUMMARY for Student ────────────────────────────────
const getPendingTasksSummary = async (req, res) => {
    const authReq = req;
    const userId = authReq.user?.id;
    if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    try {
        const [pendingRows] = await db_1.default.query(`SELECT a.id as assignment_id, a.course_id, c.slug as course_slug
       FROM assignments a
       JOIN courses c ON a.course_id = c.id
       JOIN enrollments e ON c.id = e.course_id AND e.user_id = ? AND e.status = 'ACTIVE'
       LEFT JOIN assignment_submissions sub ON a.id = sub.assignment_id AND sub.user_id = ?
       WHERE sub.id IS NULL`, [userId, userId]);
        const pendingByCourse = {};
        const pendingBySlug = {};
        let totalPending = 0;
        for (const row of pendingRows) {
            totalPending += 1;
            const cId = row.course_id;
            const cSlug = row.course_slug;
            pendingByCourse[cId] = (pendingByCourse[cId] || 0) + 1;
            if (cSlug) {
                pendingBySlug[cSlug] = (pendingBySlug[cSlug] || 0) + 1;
            }
        }
        res.json({
            totalPending,
            pendingByCourse,
            pendingBySlug,
            pendingTaskIds: pendingRows.map(r => r.assignment_id)
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
};
exports.getPendingTasksSummary = getPendingTasksSummary;
// ─── LIST ASSIGNMENTS for a course ────────────────────────────────────────
const listTasks = async (req, res) => {
    let { course_id, lesson_id } = req.query;
    const authReq = req;
    const userId = authReq.user?.id;
    try {
        let targetCourseId = course_id;
        if (isNaN(Number(course_id)) && course_id) {
            const [cRows] = await db_1.default.query('SELECT id FROM courses WHERE slug = ? OR id = ?', [course_id, course_id]);
            if (cRows.length > 0)
                targetCourseId = cRows[0].id;
        }
        let query = `SELECT
         a.*,
         l.title AS lesson_title,
         (SELECT COUNT(*) FROM assignment_submissions s WHERE s.assignment_id = a.id) AS submission_count,
         (SELECT submission_text FROM assignment_submissions s WHERE s.assignment_id = a.id AND s.user_id = ? LIMIT 1) AS my_submission,
         (SELECT file_path FROM assignment_submissions s WHERE s.assignment_id = a.id AND s.user_id = ? LIMIT 1) AS my_file_path,
         (SELECT status FROM assignment_submissions s WHERE s.assignment_id = a.id AND s.user_id = ? LIMIT 1) AS my_status,
         (SELECT points_awarded FROM assignment_submissions s WHERE s.assignment_id = a.id AND s.user_id = ? LIMIT 1) AS my_points,
         (SELECT feedback FROM assignment_submissions s WHERE s.assignment_id = a.id AND s.user_id = ? LIMIT 1) AS my_feedback
       FROM assignments a
       LEFT JOIN lessons l ON a.lesson_id = l.id
       WHERE a.course_id = ?`;
        const params = [userId, userId, userId, userId, userId, targetCourseId];
        if (lesson_id) {
            query += ` AND a.lesson_id = ?`;
            params.push(Number(lesson_id));
        }
        query += ` ORDER BY a.created_at DESC`;
        const [tasks] = await db_1.default.query(query, params);
        res.json(tasks);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
};
exports.listTasks = listTasks;
// ─── UPDATE ASSIGNMENT (Admin & Tutor) ───────────────────────────────────────
const updateTask = async (req, res) => {
    const { id } = req.params;
    const authReq = req;
    const roleId = authReq.user?.roleId;
    if (roleId !== 1 && roleId !== 2 && roleId !== 3) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }
    const { title, description, due_date, max_points, lesson_id } = req.body;
    if (!title) {
        res.status(400).json({ error: 'Title is required' });
        return;
    }
    try {
        await db_1.default.query(`UPDATE assignments 
       SET title = ?, description = ?, due_date = ?, max_points = ?, lesson_id = ?
       WHERE id = ?`, [title.trim(), description ? description.trim() : '', due_date || null, max_points || 100, lesson_id || null, id]);
        res.json({ message: 'Task updated successfully' });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
};
exports.updateTask = updateTask;
// ─── DELETE ASSIGNMENT (Admin & Tutor) ───────────────────────────────────────
const deleteTask = async (req, res) => {
    const { id } = req.params;
    const authReq = req;
    const roleId = authReq.user?.roleId;
    if (roleId !== 1 && roleId !== 2 && roleId !== 3) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }
    try {
        await db_1.default.query(`DELETE FROM assignments WHERE id = ?`, [id]);
        res.json({ message: 'Task deleted' });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
};
exports.deleteTask = deleteTask;
// ─── STUDENT: Submit answer ────────────────────────────────────────────────
// ─── STUDENT: Submit answer ────────────────────────────────────────────────
const submitTaskAnswer = async (req, res) => {
    const { id } = req.params; // assignment_id
    const { answer, filePath, files } = req.body;
    const authReq = req;
    const userId = authReq.user?.id;
    if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    const finalFilePath = filePath || (files ? (typeof files === 'string' ? files : JSON.stringify(files)) : null);
    if (!answer && !finalFilePath) {
        res.status(400).json({ error: 'Jawaban teks atau lampiran file harus diisi' });
        return;
    }
    try {
        await db_1.default.query(`INSERT INTO assignment_submissions (assignment_id, user_id, submission_text, file_path, status)
       VALUES (?, ?, ?, ?, 'SUBMITTED')
       ON DUPLICATE KEY UPDATE submission_text = VALUES(submission_text), file_path = VALUES(file_path), status = 'SUBMITTED', submitted_at = CURRENT_TIMESTAMP`, [id, userId, answer || '', finalFilePath]);
        // Get task details for notification matching
        const [taskRows] = await db_1.default.query(`SELECT title FROM assignments WHERE id = ?`, [id]);
        const taskTitle = taskRows[0]?.title || '';
        // Auto-mark notification as READ for this student when submitted
        await db_1.default.query(`UPDATE user_notifications 
       SET is_read = 1 
       WHERE user_id = ? AND (assignment_id = ? OR (message LIKE ? AND message LIKE '%tugas%'))`, [userId, id, `%${taskTitle}%`]);
        // Notify admins
        const [adminRows] = await db_1.default.query(`SELECT id FROM users WHERE role_id IN (1, 2)`);
        for (const admin of adminRows) {
            await db_1.default.query(`INSERT INTO user_notifications (user_id, title, message) VALUES (?, ?, ?)`, [admin.id, 'Submission Masuk', `Siswa mengirim jawaban untuk tugas: "${taskTitle}".`]);
        }
        res.status(201).json({ message: 'Task submitted successfully' });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
};
exports.submitTaskAnswer = submitTaskAnswer;
// ─── ADMIN: Grade a submission ─────────────────────────────────────────────
const gradeSubmission = async (req, res) => {
    const { id } = req.params; // submission id
    const { points_awarded, feedback } = req.body;
    const authReq = req;
    const roleId = authReq.user?.roleId;
    if (roleId !== 1 && roleId !== 2 && roleId !== 3) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }
    try {
        await db_1.default.query(`UPDATE assignment_submissions SET points_awarded = ?, feedback = ?, status = 'GRADED', graded_at = NOW() WHERE id = ?`, [points_awarded, feedback || null, id]);
        // Notify student about graded assignment
        try {
            const [subRows] = await db_1.default.query(`SELECT s.user_id, s.assignment_id, a.title, a.max_points 
         FROM assignment_submissions s 
         JOIN assignments a ON s.assignment_id = a.id 
         WHERE s.id = ?`, [id]);
            if (subRows.length > 0) {
                const studentId = subRows[0].user_id;
                const assignmentId = subRows[0].assignment_id;
                const taskTitle = subRows[0].title;
                const maxPts = subRows[0].max_points || 100;
                await db_1.default.query(`INSERT INTO user_notifications (user_id, assignment_id, title, message, is_read) 
           VALUES (?, ?, ?, ?, 0)`, [
                    studentId,
                    assignmentId,
                    'Tugas Telah Dinilai',
                    `Tugas "${taskTitle}" Anda telah dinilai oleh Guru: ${points_awarded}/${maxPts} Poin.`
                ]);
            }
        }
        catch (notifErr) {
            console.error('Failed to notify student on grade:', notifErr);
        }
        res.json({ message: 'Submission graded' });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
};
exports.gradeSubmission = gradeSubmission;
// ─── ADMIN: List all submissions for an assignment ─────────────────────────
const listTaskSubmissions = async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await db_1.default.query(`SELECT s.id, s.submission_text, s.file_path, s.status, s.points_awarded, s.feedback, s.submitted_at, s.graded_at,
              u.full_name, u.email
       FROM assignment_submissions s
       JOIN users u ON s.user_id = u.id
       WHERE s.assignment_id = ?
       ORDER BY s.submitted_at DESC`, [id]);
        res.json(rows);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
};
exports.listTaskSubmissions = listTaskSubmissions;
// Keep these stubs for backward compat with old route file
exports.createTask_stub = exports.createTask;
const assignTask = async (req, res) => {
    res.status(410).json({ message: 'Use submitTaskAnswer instead' });
};
exports.assignTask = assignTask;
const updateTaskStatus = async (req, res) => {
    res.status(410).json({ message: 'Use gradeSubmission instead' });
};
exports.updateTaskStatus = updateTaskStatus;
