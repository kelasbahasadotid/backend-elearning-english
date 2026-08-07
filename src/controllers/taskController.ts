import { Request, Response } from 'express';
import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// ─── CREATE ASSIGNMENT (Admin/Super Admin) ─────────────────────────────────
export const createTask = async (req: Request, res: Response) => {
  const authReq = req as any;
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
      const [cRows] = await pool.query<RowDataPacket[]>('SELECT id FROM courses WHERE slug = ? OR id = ?', [course_id, course_id]);
      if (cRows.length > 0) course_id = cRows[0].id;
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO assignments (course_id, lesson_id, title, description, due_date, max_points)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [course_id, lesson_id || null, title, description || '', due_date || null, max_points || 100]
    );
    const taskId = result.insertId;

    // Notify all enrolled students in the course, or all student users if no specific enrollments exist
    let [students] = await pool.query<RowDataPacket[]>(
      `SELECT DISTINCT user_id FROM enrollments WHERE course_id = ?`,
      [course_id]
    );
    if (students.length === 0) {
      [students] = await pool.query<RowDataPacket[]>(
        `SELECT id AS user_id FROM users WHERE role_id IN (3, 4)`
      );
    }
    for (const student of students) {
      await pool.query(
        `INSERT INTO user_notifications (user_id, assignment_id, title, message, is_read) VALUES (?, ?, ?, ?, 0)`,
        [student.user_id, taskId, 'Tugas Baru Tersedia', `Tugas baru "${title}" telah ditambahkan di kursus Anda.`]
      );
    }

    res.status(201).json({ message: 'Task created', taskId });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// ─── GET PENDING TASKS SUMMARY for Student ────────────────────────────────
export const getPendingTasksSummary = async (req: Request, res: Response) => {
  const authReq = req as any;
  const userId = authReq.user?.id;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const [pendingRows] = await pool.query<RowDataPacket[]>(
      `SELECT a.id as assignment_id, a.course_id, c.slug as course_slug
       FROM assignments a
       JOIN courses c ON a.course_id = c.id
       JOIN enrollments e ON c.id = e.course_id AND e.user_id = ? AND e.status = 'ACTIVE'
       LEFT JOIN assignment_submissions sub ON a.id = sub.assignment_id AND sub.user_id = ?
       WHERE sub.id IS NULL`,
      [userId, userId]
    );

    const pendingByCourse: Record<number, number> = {};
    const pendingBySlug: Record<string, number> = {};
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
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// ─── LIST ASSIGNMENTS for a course ────────────────────────────────────────
export const listTasks = async (req: Request, res: Response) => {
  let { course_id, lesson_id } = req.query;
  const authReq = req as any;
  const userId = authReq.user?.id;

  try {
    let targetCourseId = course_id;
    if (isNaN(Number(course_id)) && course_id) {
      const [cRows] = await pool.query<RowDataPacket[]>('SELECT id FROM courses WHERE slug = ? OR id = ?', [course_id, course_id]);
      if (cRows.length > 0) targetCourseId = cRows[0].id;
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

    const [tasks] = await pool.query<RowDataPacket[]>(query, params);
    res.json(tasks);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// ─── UPDATE ASSIGNMENT (Admin only) ───────────────────────────────────────
export const updateTask = async (req: Request, res: Response) => {
  const { id } = req.params;
  const authReq = req as any;
  const roleId = authReq.user?.roleId;
  if (roleId !== 1 && roleId !== 2) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const { title, description, due_date, max_points, lesson_id } = req.body;
  if (!title) {
    res.status(400).json({ error: 'Title is required' });
    return;
  }
  try {
    await pool.query(
      `UPDATE assignments 
       SET title = ?, description = ?, due_date = ?, max_points = ?, lesson_id = ?
       WHERE id = ?`,
      [title.trim(), description ? description.trim() : '', due_date || null, max_points || 100, lesson_id || null, id]
    );
    res.json({ message: 'Task updated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// ─── DELETE ASSIGNMENT (Admin only) ───────────────────────────────────────
export const deleteTask = async (req: Request, res: Response) => {
  const { id } = req.params;
  const authReq = req as any;
  const roleId = authReq.user?.roleId;
  if (roleId !== 1 && roleId !== 2) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  try {
    await pool.query(`DELETE FROM assignments WHERE id = ?`, [id]);
    res.json({ message: 'Task deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// ─── STUDENT: Submit answer ────────────────────────────────────────────────
// ─── STUDENT: Submit answer ────────────────────────────────────────────────
export const submitTaskAnswer = async (req: Request, res: Response) => {
  const { id } = req.params; // assignment_id
  const { answer, filePath, files } = req.body;
  const authReq = req as any;
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
    await pool.query(
      `INSERT INTO assignment_submissions (assignment_id, user_id, submission_text, file_path, status)
       VALUES (?, ?, ?, ?, 'SUBMITTED')
       ON DUPLICATE KEY UPDATE submission_text = VALUES(submission_text), file_path = VALUES(file_path), status = 'SUBMITTED', submitted_at = CURRENT_TIMESTAMP`,
      [id, userId, answer || '', finalFilePath]
    );

    // Get task details for notification matching
    const [taskRows] = await pool.query<RowDataPacket[]>(`SELECT title FROM assignments WHERE id = ?`, [id]);
    const taskTitle = taskRows[0]?.title || '';

    // Auto-mark notification as READ for this student when submitted
    await pool.query(
      `UPDATE user_notifications 
       SET is_read = 1 
       WHERE user_id = ? AND (assignment_id = ? OR (message LIKE ? AND message LIKE '%tugas%'))`,
      [userId, id, `%${taskTitle}%`]
    );

    // Notify admins
    const [adminRows] = await pool.query<RowDataPacket[]>(`SELECT id FROM users WHERE role_id IN (1, 2)`);
    for (const admin of adminRows) {
      await pool.query(
        `INSERT INTO user_notifications (user_id, title, message) VALUES (?, ?, ?)`,
        [admin.id, 'Submission Masuk', `Siswa mengirim jawaban untuk tugas: "${taskTitle}".`]
      );
    }

    res.status(201).json({ message: 'Task submitted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// ─── ADMIN: Grade a submission ─────────────────────────────────────────────
export const gradeSubmission = async (req: Request, res: Response) => {
  const { id } = req.params; // submission id
  const { points_awarded, feedback } = req.body;
  const authReq = req as any;
  const roleId = authReq.user?.roleId;
  if (roleId !== 1 && roleId !== 2 && roleId !== 3) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  try {
    await pool.query(
      `UPDATE assignment_submissions SET points_awarded = ?, feedback = ?, status = 'GRADED', graded_at = NOW() WHERE id = ?`,
      [points_awarded, feedback || null, id]
    );

    // Notify student about graded assignment
    try {
      const [subRows] = await pool.query<RowDataPacket[]>(
        `SELECT s.user_id, s.assignment_id, a.title, a.max_points 
         FROM assignment_submissions s 
         JOIN assignments a ON s.assignment_id = a.id 
         WHERE s.id = ?`,
        [id]
      );
      if (subRows.length > 0) {
        const studentId = subRows[0].user_id;
        const assignmentId = subRows[0].assignment_id;
        const taskTitle = subRows[0].title;
        const maxPts = subRows[0].max_points || 100;
        await pool.query(
          `INSERT INTO user_notifications (user_id, assignment_id, title, message, is_read) 
           VALUES (?, ?, ?, ?, 0)`,
          [
            studentId,
            assignmentId,
            'Tugas Telah Dinilai',
            `Tugas "${taskTitle}" Anda telah dinilai oleh Guru: ${points_awarded}/${maxPts} Poin.`
          ]
        );
      }
    } catch (notifErr) {
      console.error('Failed to notify student on grade:', notifErr);
    }

    res.json({ message: 'Submission graded' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// ─── ADMIN: List all submissions for an assignment ─────────────────────────
export const listTaskSubmissions = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT s.id, s.submission_text, s.file_path, s.status, s.points_awarded, s.feedback, s.submitted_at, s.graded_at,
              u.full_name, u.email
       FROM assignment_submissions s
       JOIN users u ON s.user_id = u.id
       WHERE s.assignment_id = ?
       ORDER BY s.submitted_at DESC`,
      [id]
    );
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// Keep these stubs for backward compat with old route file
export const createTask_stub = createTask;
export const assignTask = async (req: Request, res: Response) => {
  res.status(410).json({ message: 'Use submitTaskAnswer instead' });
};
export const updateTaskStatus = async (req: Request, res: Response) => {
  res.status(410).json({ message: 'Use gradeSubmission instead' });
};
