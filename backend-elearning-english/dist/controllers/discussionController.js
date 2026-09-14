"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteComment = exports.deleteDiscussion = exports.listComments = exports.listDiscussions = exports.addComment = exports.createDiscussion = void 0;
const db_1 = __importDefault(require("../config/db"));
// ─── CREATE DISCUSSION TOPIC ───────────────────────────────────────────────
const createDiscussion = async (req, res) => {
    let { course_id, title, body } = req.body;
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!course_id || !title) {
        return res.status(400).json({ error: 'course_id and title are required' });
    }
    try {
        if (isNaN(Number(course_id)) && course_id) {
            const [cRows] = await db_1.default.query('SELECT id FROM courses WHERE slug = ? OR id = ?', [course_id, course_id]);
            if (cRows.length > 0)
                course_id = cRows[0].id;
        }
        const [result] = await db_1.default.query(`INSERT INTO discussion_topics (course_id, user_id, title, body) VALUES (?, ?, ?, ?)`, [course_id, userId, title, body || '']);
        res.status(201).json({ discussionId: result.insertId });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
};
exports.createDiscussion = createDiscussion;
// ─── ADD A REPLY TO A TOPIC ────────────────────────────────────────────────
const addComment = async (req, res) => {
    const { discussion_id, comment } = req.body;
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!discussion_id || !comment) {
        return res.status(400).json({ error: 'discussion_id and comment are required' });
    }
    try {
        const [result] = await db_1.default.query(`INSERT INTO discussion_replies (topic_id, user_id, body) VALUES (?, ?, ?)`, [discussion_id, userId, comment]);
        res.status(201).json({ message: 'Comment added', commentId: result.insertId });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
};
exports.addComment = addComment;
// ─── LIST DISCUSSIONS for a course ────────────────────────────────────────
const listDiscussions = async (req, res) => {
    let { course_id } = req.query;
    if (!course_id) {
        return res.status(400).json({ error: 'course_id is required' });
    }
    try {
        let targetCourseId = course_id;
        if (isNaN(Number(course_id)) && course_id) {
            const [cRows] = await db_1.default.query('SELECT id FROM courses WHERE slug = ? OR id = ?', [course_id, course_id]);
            if (cRows.length > 0)
                targetCourseId = cRows[0].id;
        }
        const [rows] = await db_1.default.query(`SELECT
         d.id, d.title, d.body, d.created_at,
         u.full_name AS author_name, u.id AS user_id, u.role_id,
         COUNT(r.id) AS comment_count
       FROM discussion_topics d
       JOIN users u ON d.user_id = u.id
       LEFT JOIN discussion_replies r ON r.topic_id = d.id
       WHERE d.course_id = ?
       GROUP BY d.id
       ORDER BY d.created_at DESC`, [targetCourseId]);
        res.json(rows);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
};
exports.listDiscussions = listDiscussions;
// ─── LIST REPLIES for a discussion topic ──────────────────────────────────
const listComments = async (req, res) => {
    const { discussion_id } = req.query;
    if (!discussion_id) {
        return res.status(400).json({ error: 'discussion_id is required' });
    }
    try {
        const [rows] = await db_1.default.query(`SELECT r.id, r.body AS comment, r.created_at, u.full_name AS author_name, u.id AS user_id, u.role_id
       FROM discussion_replies r
       JOIN users u ON r.user_id = u.id
       WHERE r.topic_id = ?
       ORDER BY r.created_at ASC`, [discussion_id]);
        res.json(rows);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
};
exports.listComments = listComments;
// ─── DELETE DISCUSSION TOPIC ───────────────────────────────────────────────
const deleteDiscussion = async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.id;
    const roleId = req.user?.roleId;
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        // Allow admin or topic owner to delete
        const [rows] = await db_1.default.query(`SELECT user_id FROM discussion_topics WHERE id = ?`, [id]);
        if (rows.length === 0)
            return res.status(404).json({ error: 'Discussion not found' });
        if (rows[0].user_id !== userId && roleId !== 1 && roleId !== 2) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        await db_1.default.query(`DELETE FROM discussion_topics WHERE id = ?`, [id]);
        res.json({ message: 'Discussion deleted' });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
};
exports.deleteDiscussion = deleteDiscussion;
// ─── DELETE A REPLY ────────────────────────────────────────────────────────
const deleteComment = async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.id;
    const roleId = req.user?.roleId;
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        const [rows] = await db_1.default.query(`SELECT user_id FROM discussion_replies WHERE id = ?`, [id]);
        if (rows.length === 0)
            return res.status(404).json({ error: 'Comment not found' });
        if (rows[0].user_id !== userId && roleId !== 1 && roleId !== 2) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        await db_1.default.query(`DELETE FROM discussion_replies WHERE id = ?`, [id]);
        res.json({ message: 'Comment deleted' });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
};
exports.deleteComment = deleteComment;
