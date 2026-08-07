import { Response } from 'express';
import pool from '../config/db';
import { AuthRequest } from '../middleware/auth';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

// Notifications
export const getNotifications = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const [notifs] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM user_notifications WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(notifs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const markNotificationRead = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const { id } = req.params;
  try {
    await pool.query(
      'UPDATE user_notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );
    res.json({ message: 'Notification marked as read' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Assignments
export const getAssignments = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const [assigns] = await pool.query<RowDataPacket[]>(
      `SELECT a.*, c.title as course_title, c.slug as course_slug, sub.id as submission_id, sub.submission_text, sub.file_path, sub.points_awarded, sub.feedback, sub.status as submission_status, sub.submitted_at
       FROM assignments a
       JOIN courses c ON a.course_id = c.id
       JOIN enrollments e ON c.id = e.course_id AND e.user_id = ? AND e.status = 'ACTIVE'
       LEFT JOIN assignment_submissions sub ON a.id = sub.assignment_id AND sub.user_id = ?`,
      [req.user.id, req.user.id]
    );
    res.json(assigns);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const submitAssignment = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const { assignmentId, submissionText, filePath, files } = req.body;
  const finalFilePath = filePath || (files ? (typeof files === 'string' ? files : JSON.stringify(files)) : null);

  if (!submissionText && !finalFilePath) {
    res.status(400).json({ error: 'Jawaban teks atau lampiran file harus diisi' });
    return;
  }

  try {
    await pool.query(
      `INSERT INTO assignment_submissions (assignment_id, user_id, submission_text, file_path, status) 
       VALUES (?, ?, ?, ?, "SUBMITTED")
       ON DUPLICATE KEY UPDATE submission_text = VALUES(submission_text), file_path = VALUES(file_path), status = "SUBMITTED", submitted_at = CURRENT_TIMESTAMP`,
      [assignmentId, req.user.id, submissionText || '', finalFilePath]
    );

    // Auto mark notification read for this assignment
    const [taskRows] = await pool.query<RowDataPacket[]>('SELECT title FROM assignments WHERE id = ?', [assignmentId]);
    const taskTitle = taskRows[0]?.title || '';
    await pool.query(
      `UPDATE user_notifications 
       SET is_read = 1 
       WHERE user_id = ? AND (assignment_id = ? OR (message LIKE ? AND message LIKE '%tugas%'))`,
      [req.user.id, assignmentId, `%${taskTitle}%`]
    );

    res.status(201).json({ message: 'Assignment submitted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Discussions
export const getDiscussionTopics = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const { courseId } = req.query;
  try {
    const queryParams: any[] = [req.user.id];
    let queryStr = `
      SELECT dt.*, u.full_name as author_name, c.title as course_title, c.slug as course_slug,
             (SELECT COUNT(*) FROM discussion_replies dr WHERE dr.topic_id = dt.id) as replies_count
      FROM discussion_topics dt
      JOIN users u ON dt.user_id = u.id
      JOIN courses c ON dt.course_id = c.id
      JOIN enrollments e ON dt.course_id = e.course_id AND e.user_id = ? AND e.status = 'ACTIVE'
    `;

    if (courseId) {
      queryStr += ' WHERE dt.course_id = ? ';
      queryParams.push(courseId);
    }

    queryStr += ' ORDER BY dt.created_at DESC ';

    const [topics] = await pool.query<RowDataPacket[]>(queryStr, queryParams);
    res.json(topics);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createDiscussionTopic = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const { courseId, title, body } = req.body;
  try {
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO discussion_topics (course_id, user_id, title, body) VALUES (?, ?, ?, ?)',
      [courseId, req.user.id, title, body]
    );
    res.status(201).json({ message: 'Discussion topic created successfully', topicId: result.insertId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getDiscussionReplies = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const { id } = req.params;
  try {
    const [replies] = await pool.query<RowDataPacket[]>(
      `SELECT dr.*, u.full_name as author_name, u.role_id
       FROM discussion_replies dr
       JOIN users u ON dr.user_id = u.id
       WHERE dr.topic_id = ?
       ORDER BY dr.created_at ASC`,
      [id]
    );
    res.json(replies);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createDiscussionReply = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const { id } = req.params;
  const { body } = req.body;
  try {
    await pool.query(
      'INSERT INTO discussion_replies (topic_id, user_id, body) VALUES (?, ?, ?)',
      [id, req.user.id, body]
    );
    res.status(201).json({ message: 'Reply posted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
