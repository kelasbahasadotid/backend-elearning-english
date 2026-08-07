import { Request, Response } from 'express';
import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// ─── CREATE DISCUSSION TOPIC ───────────────────────────────────────────────
export const createDiscussion = async (req: Request, res: Response) => {
  let { course_id, title, body } = req.body;
  const userId = (req as any).user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!course_id || !title) {
    return res.status(400).json({ error: 'course_id and title are required' });
  }
  try {
    if (isNaN(Number(course_id)) && course_id) {
      const [cRows] = await pool.query<RowDataPacket[]>('SELECT id FROM courses WHERE slug = ? OR id = ?', [course_id, course_id]);
      if (cRows.length > 0) course_id = cRows[0].id;
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO discussion_topics (course_id, user_id, title, body) VALUES (?, ?, ?, ?)`,
      [course_id, userId, title, body || '']
    );
    res.status(201).json({ discussionId: result.insertId });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

// ─── ADD A REPLY TO A TOPIC ────────────────────────────────────────────────
export const addComment = async (req: Request, res: Response) => {
  const { discussion_id, comment } = req.body;
  const userId = (req as any).user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!discussion_id || !comment) {
    return res.status(400).json({ error: 'discussion_id and comment are required' });
  }
  try {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO discussion_replies (topic_id, user_id, body) VALUES (?, ?, ?)`,
      [discussion_id, userId, comment]
    );
    res.status(201).json({ message: 'Comment added', commentId: result.insertId });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

// ─── LIST DISCUSSIONS for a course ────────────────────────────────────────
export const listDiscussions = async (req: Request, res: Response) => {
  let { course_id } = req.query;
  if (!course_id) {
    return res.status(400).json({ error: 'course_id is required' });
  }
  try {
    let targetCourseId = course_id;
    if (isNaN(Number(course_id)) && course_id) {
      const [cRows] = await pool.query<RowDataPacket[]>('SELECT id FROM courses WHERE slug = ? OR id = ?', [course_id, course_id]);
      if (cRows.length > 0) targetCourseId = cRows[0].id;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         d.id, d.title, d.body, d.created_at,
         u.full_name AS author_name, u.id AS user_id, u.role_id,
         COUNT(r.id) AS comment_count
       FROM discussion_topics d
       JOIN users u ON d.user_id = u.id
       LEFT JOIN discussion_replies r ON r.topic_id = d.id
       WHERE d.course_id = ?
       GROUP BY d.id
       ORDER BY d.created_at DESC`,
      [targetCourseId]
    );
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

// ─── LIST REPLIES for a discussion topic ──────────────────────────────────
export const listComments = async (req: Request, res: Response) => {
  const { discussion_id } = req.query;
  if (!discussion_id) {
    return res.status(400).json({ error: 'discussion_id is required' });
  }
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT r.id, r.body AS comment, r.created_at, u.full_name AS author_name, u.id AS user_id, u.role_id
       FROM discussion_replies r
       JOIN users u ON r.user_id = u.id
       WHERE r.topic_id = ?
       ORDER BY r.created_at ASC`,
      [discussion_id]
    );
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

// ─── DELETE DISCUSSION TOPIC ───────────────────────────────────────────────
export const deleteDiscussion = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req as any).user?.id;
  const roleId = (req as any).user?.roleId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    // Allow admin or topic owner to delete
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT user_id FROM discussion_topics WHERE id = ?`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Discussion not found' });
    if (rows[0].user_id !== userId && roleId !== 1 && roleId !== 2) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await pool.query(`DELETE FROM discussion_topics WHERE id = ?`, [id]);
    res.json({ message: 'Discussion deleted' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

// ─── DELETE A REPLY ────────────────────────────────────────────────────────
export const deleteComment = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req as any).user?.id;
  const roleId = (req as any).user?.roleId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT user_id FROM discussion_replies WHERE id = ?`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Comment not found' });
    if (rows[0].user_id !== userId && roleId !== 1 && roleId !== 2) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await pool.query(`DELETE FROM discussion_replies WHERE id = ?`, [id]);
    res.json({ message: 'Comment deleted' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};
