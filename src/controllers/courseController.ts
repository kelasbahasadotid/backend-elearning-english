import { Request, Response } from 'express';
import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import jwt from 'jsonwebtoken';

export const getLandingPage = async (req: Request, res: Response) => {
  try {
    // 1. Fetch active banners
    const [banners] = await pool.query<RowDataPacket[]>(
      'SELECT id, title, image_path, button_text, button_url FROM banners WHERE active = 1 AND (start_date IS NULL OR start_date <= NOW()) AND (end_date IS NULL OR end_date >= NOW())'
    );

    // 2. Fetch popular/featured courses (limit to 6)
    const [courses] = await pool.query<RowDataPacket[]>(
      `SELECT c.id, c.code, c.title, c.slug, c.short_description, c.description, c.thumbnail, c.price, c.discount_price, c.cefr_level, c.duration_minutes, cat.name as category_name,
              COALESCE((SELECT AVG(rating) FROM course_reviews WHERE course_id = c.id), 4.8) as rating,
              (SELECT COUNT(*) FROM course_reviews WHERE course_id = c.id) as reviewsCount,
              (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id AND status = 'ACTIVE') as studentCount
       FROM courses c
       LEFT JOIN course_categories cat ON c.category_id = cat.id
       WHERE c.status = 'PUBLISHED'
       ORDER BY c.created_at DESC
       LIMIT 6`
    );

    res.json({ banners, courses });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const getCourses = async (req: Request, res: Response) => {
  let showAll = false;
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecret_pronunciation_ai_key') as any;
      if (decoded.roleId === 1 || decoded.roleId === 2 || decoded.roleId === 5) {
        showAll = true;
      }
    } catch (err) {
      // Ignore
    }
  }

  try {
    const sql = `
      SELECT c.id, c.code, c.title, c.slug, c.short_description, c.description, c.thumbnail, c.price, c.discount_price, c.cefr_level, c.duration_minutes, c.status, cat.name as category_name,
             COALESCE((SELECT AVG(rating) FROM course_reviews WHERE course_id = c.id), 4.8) as rating,
             (SELECT COUNT(*) FROM course_reviews WHERE course_id = c.id) as reviewsCount,
             (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id AND status = 'ACTIVE') as studentCount
      FROM courses c
      LEFT JOIN course_categories cat ON c.category_id = cat.id
      ${showAll ? '' : "WHERE c.status = 'PUBLISHED'"}
      ORDER BY c.created_at DESC
    `;
    const [courses] = await pool.query<RowDataPacket[]>(sql);
    res.json(courses);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const getCourseDetails = async (req: Request, res: Response) => {
  const { slug } = req.params;

  // Try to parse optional authorization token to identify student progress
  let userId: number | null = null;
  let userRoleId: number | null = null;
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecret_pronunciation_ai_key') as any;
      userId = decoded.id;
      userRoleId = decoded.roleId;
    } catch (err) {
      // Ignore invalid token and treat as public guest
    }
  }

  const isAdminOrTutor = userRoleId === 1 || userRoleId === 2 || userRoleId === 5;
  const isNumericId = !isNaN(Number(slug));

  try {
    // 1. Fetch course details (accepts either slug or numeric ID)
    const courseQuery = isAdminOrTutor
      ? `SELECT c.*, cat.name as category_name,
                COALESCE((SELECT AVG(rating) FROM course_reviews WHERE course_id = c.id), 4.8) as rating,
                (SELECT COUNT(*) FROM course_reviews WHERE course_id = c.id) as reviewsCount,
                (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id AND status = 'ACTIVE') as studentCount
         FROM courses c
         LEFT JOIN course_categories cat ON c.category_id = cat.id
         WHERE ${isNumericId ? 'c.id = ?' : 'c.slug = ?'}`
      : `SELECT c.*, cat.name as category_name,
                COALESCE((SELECT AVG(rating) FROM course_reviews WHERE course_id = c.id), 4.8) as rating,
                (SELECT COUNT(*) FROM course_reviews WHERE course_id = c.id) as reviewsCount,
                (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id AND status = 'ACTIVE') as studentCount
         FROM courses c
         LEFT JOIN course_categories cat ON c.category_id = cat.id
         WHERE (${isNumericId ? 'c.id = ?' : 'c.slug = ?'}) AND (c.status = 'PUBLISHED' OR EXISTS (SELECT 1 FROM enrollments WHERE user_id = ? AND course_id = c.id AND status = 'ACTIVE'))`;

    const queryParams = isAdminOrTutor ? [slug] : (userId ? [slug, userId] : [slug]);
    const [courses] = await pool.query<RowDataPacket[]>(courseQuery, queryParams);

    if (courses.length === 0) {
       res.status(404).json({ error: 'Course not found' });
       return;
    }

    const course = courses[0];

    // 2. Fetch the current active course version
    let [versions] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM course_versions WHERE course_id = ? AND is_current = 1 LIMIT 1',
      [course.id]
    );

    if (versions.length === 0) {
      // Auto-provision a default course version if missing
      const [insertResult] = await pool.query<ResultSetHeader>(
        'INSERT INTO course_versions (course_id, version, is_current, created_by) VALUES (?, ?, ?, ?)',
        [course.id, 'v1.0.0', 1, course.created_by || 1]
      );
      const [reFetch] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM course_versions WHERE id = ?',
        [insertResult.insertId]
      );
      versions = reFetch;
    }

    const versionId = versions[0].id;
    let modules: any[] = [];

    // 3. Fetch modules in this version
    const modulesQuery = isAdminOrTutor
      ? 'SELECT id, title, description, module_order, estimated_minutes, status FROM modules WHERE course_version_id = ? ORDER BY module_order ASC'
      : 'SELECT id, title, description, module_order, estimated_minutes, status FROM modules WHERE course_version_id = ? AND status = "PUBLISHED" ORDER BY module_order ASC';

    const [moduleRows] = await pool.query<RowDataPacket[]>(modulesQuery, [versionId]);

    modules = moduleRows;

    // 4. Fetch lessons for each module (including completed progress if user logged in)
    for (const mod of modules) {
      const lessonsQuery = isAdminOrTutor
        ? `SELECT l.id, l.title, l.slug, l.lesson_type, l.lesson_order, l.duration_minutes, l.is_preview, l.xp_reward, l.status,
                  COALESCE(a.max_attempt, l.max_attempt) as max_attempt,
                  COALESCE(lp.completed, 0) as completed
           FROM lessons l
           LEFT JOIN assessments a ON l.id = a.lesson_id
           LEFT JOIN lesson_progress lp ON l.id = lp.lesson_id AND lp.user_id = ?
           WHERE l.module_id = ? AND l.deleted_at IS NULL
           ORDER BY l.lesson_order ASC`
        : `SELECT l.id, l.title, l.slug, l.lesson_type, l.lesson_order, l.duration_minutes, l.is_preview, l.xp_reward, l.status,
                  COALESCE(a.max_attempt, l.max_attempt) as max_attempt,
                  COALESCE(lp.completed, 0) as completed
           FROM lessons l
           LEFT JOIN assessments a ON l.id = a.lesson_id
           LEFT JOIN lesson_progress lp ON l.id = lp.lesson_id AND lp.user_id = ?
           WHERE l.module_id = ? AND l.status = 'PUBLISHED' AND l.deleted_at IS NULL
           ORDER BY l.lesson_order ASC`;

      const [lessonRows] = await pool.query<RowDataPacket[]>(lessonsQuery, [userId || 0, mod.id]);
      
      mod.lessons = lessonRows.map((r: any) => ({
        ...r,
        completed: !!r.completed
      }));
    }

    let quizScores: any[] = [];
    let speakingScores: any[] = [];
    if (userId) {
      const [qScores] = await pool.query<RowDataPacket[]>(
        `SELECT a.id as assessment_id, a.lesson_id, l.title as lesson_title, l.lesson_type, ap.highest_score, ap.total_attempt, ap.passed
         FROM assessments a
         JOIN lessons l ON a.lesson_id = l.id
         JOIN modules m ON l.module_id = m.id
         LEFT JOIN assessment_progress ap ON a.id = ap.assessment_id AND ap.user_id = ?
         WHERE m.course_version_id = ? AND a.status = 'PUBLISHED'`,
        [userId, versionId]
      );
      quizScores = qScores;

      const [sScores] = await pool.query<RowDataPacket[]>(
        `SELECT st.id as speaking_test_id, a.lesson_id, l.title as lesson_title, l.lesson_type, 
                MAX(sa.overall_score) as highest_score, COUNT(sa.id) as total_attempt,
                MAX(CASE WHEN sa.overall_score >= COALESCE(a.passing_score, 60) THEN 1 ELSE 0 END) as passed
         FROM speaking_tests st
         JOIN assessments a ON st.assessment_id = a.id
         JOIN lessons l ON a.lesson_id = l.id
         JOIN modules m ON l.module_id = m.id
         LEFT JOIN speaking_attempts sa ON st.id = sa.speaking_test_id AND sa.user_id = ?
         WHERE m.course_version_id = ? AND a.status = 'PUBLISHED'
         GROUP BY st.id, a.lesson_id, l.title, l.lesson_type`,
        [userId, versionId]
      );
      speakingScores = sScores;
    }

    // Fetch reviews for this course
    const [reviews] = await pool.query<RowDataPacket[]>(
      `SELECT r.id, r.rating, r.review_text, r.created_at, u.full_name as reviewer_name,
              r.reply_text, r.replied_at, u2.full_name as replier_name
       FROM course_reviews r
       JOIN users u ON r.user_id = u.id
       LEFT JOIN users u2 ON r.replied_by = u2.id
       WHERE r.course_id = ?
       ORDER BY r.created_at DESC`,
      [course.id]
    );

    // Fetch announcements for this course
    const [announcements] = await pool.query<RowDataPacket[]>(
      `SELECT a.id, a.title, a.content, a.created_at, u.full_name as announcer_name
       FROM course_announcements a
       JOIN users u ON a.created_by = u.id
       WHERE a.course_id = ?
       ORDER BY a.created_at DESC`,
      [course.id]
    );

    res.json({
      course: {
        ...course,
        course_version_id: versionId
      },
      modules,
      quizScores,
      speakingScores,
      reviews,
      announcements
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const createCourseReview = async (req: Request, res: Response) => {
  const { id } = req.params; // course_id
  const { rating, review_text } = req.body;
  const authReq = req as any;
  const userId = authReq.user?.id;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (rating === undefined || rating < 1 || rating > 5) {
    res.status(400).json({ error: 'Rating must be between 1.0 and 5.0' });
    return;
  }

  try {
    const [enrollment] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM enrollments WHERE user_id = ? AND course_id = ? AND status = "ACTIVE"',
      [userId, id]
    );

    if (enrollment.length === 0) {
      res.status(403).json({ error: 'You must be actively enrolled to review this course' });
      return;
    }

    await pool.query(
      `INSERT INTO course_reviews (course_id, user_id, rating, review_text)
       VALUES (?, ?, ?, ?)`,
      [id, userId, rating, review_text || '']
    );

    // Create notifications for all admins
    try {
      const [userRows] = await pool.query<RowDataPacket[]>('SELECT full_name FROM users WHERE id = ?', [userId]);
      const [courseRows] = await pool.query<RowDataPacket[]>('SELECT title FROM courses WHERE id = ?', [id]);
      const reviewerName = userRows[0]?.full_name || 'A student';
      const courseTitle = courseRows[0]?.title || 'a course';

      const [adminRows] = await pool.query<RowDataPacket[]>('SELECT id FROM users WHERE role_id IN (1, 2)');
      for (const adminUser of adminRows) {
        await pool.query(
          `INSERT INTO user_notifications (user_id, title, message) 
           VALUES (?, ?, ?)`,
          [
            adminUser.id,
            'New Student Review',
            `${reviewerName} posted a ${rating}-star review on ${courseTitle}.`
          ]
        );
      }
    } catch (notifErr) {
      console.error('Failed to create review notification:', notifErr);
    }

    res.json({ message: 'Review posted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const replyCourseReview = async (req: Request, res: Response) => {
  const { id } = req.params; // review_id
  const { reply_text } = req.body;
  const authReq = req as any;
  const adminId = authReq.user?.id;

  if (!adminId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!reply_text || reply_text.trim() === '') {
    res.status(400).json({ error: 'Reply text cannot be empty' });
    return;
  }

  try {
    await pool.query(
      `UPDATE course_reviews 
       SET reply_text = ?, replied_by = ?, replied_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [reply_text, adminId, id]
    );

    // Create notification for review writer
    try {
      const [reviewRows] = await pool.query<RowDataPacket[]>(
        `SELECT r.user_id, c.title 
         FROM course_reviews r
         JOIN courses c ON r.course_id = c.id
         WHERE r.id = ?`,
        [id]
      );
      if (reviewRows.length > 0) {
        const studentId = reviewRows[0].user_id;
        const courseTitle = reviewRows[0].title;
        await pool.query(
          `INSERT INTO user_notifications (user_id, title, message) 
           VALUES (?, ?, ?)`,
          [
            studentId,
            'Admin Replied to Your Review',
            `An instructor responded to your review on ${courseTitle}: "${reply_text.length > 50 ? reply_text.substring(0, 47) + '...' : reply_text}"`
          ]
        );
      }
    } catch (notifErr) {
      console.error('Failed to create reply notification:', notifErr);
    }

    res.json({ message: 'Reply posted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const createCourseAnnouncement = async (req: Request, res: Response) => {
  const { id } = req.params; // course_id
  const { title, content } = req.body;
  const authReq = req as any;
  const adminId = authReq.user?.id;

  if (!adminId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!title || title.trim() === '' || !content || content.trim() === '') {
    res.status(400).json({ error: 'Title and content are required' });
    return;
  }

  try {
    await pool.query(
      `INSERT INTO course_announcements (course_id, title, content, created_by)
       VALUES (?, ?, ?, ?)`,
      [id, title, content, adminId]
    );

    // Notify all enrolled students (or members if no specific enrollments)
    try {
      const [cRows] = await pool.query<RowDataPacket[]>('SELECT title FROM courses WHERE id = ?', [id]);
      const courseTitle = cRows[0]?.title || 'Kursus';
      let [students] = await pool.query<RowDataPacket[]>(
        `SELECT DISTINCT user_id FROM enrollments WHERE course_id = ?`,
        [id]
      );
      if (students.length === 0) {
        [students] = await pool.query<RowDataPacket[]>(
          `SELECT id AS user_id FROM users WHERE role_id = 4`
        );
      }
      for (const student of students) {
        await pool.query(
          `INSERT INTO user_notifications (user_id, title, message, is_read) VALUES (?, ?, ?, 0)`,
          [student.user_id, `Pengumuman: ${title}`, `Pengumuman baru di ${courseTitle}: "${title}".`]
        );
      }
    } catch (notifErr) {
      console.error('Failed to send announcement notification:', notifErr);
    }

    res.json({ message: 'Announcement posted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const deleteCourseAnnouncement = async (req: Request, res: Response) => {
  const { id } = req.params; // announcement_id
  const authReq = req as any;
  const adminId = authReq.user?.id;

  if (!adminId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    await pool.query('DELETE FROM course_announcements WHERE id = ?', [id]);
    res.json({ message: 'Announcement deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

/**
 * GET /api/courses/presentation/:contentId/file.pptx
 * Serves the raw PPTX file attachment from database as a public HTTP binary file
 * for Microsoft Office Online Viewer and ONLYOFFICE Document Server
 */
export const getPresentationFile = async (req: Request, res: Response) => {
  const { contentId } = req.params;
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT attachments FROM lesson_contents WHERE id = ?',
      [contentId]
    );

    if (!rows || rows.length === 0 || !rows[0].attachments) {
      res.status(404).send('Presentation file not found');
      return;
    }

    let attachments: any[] = [];
    try {
      attachments = typeof rows[0].attachments === 'string' ? JSON.parse(rows[0].attachments) : rows[0].attachments;
    } catch (e) {
      // fallback
    }

    const pptxAtt = attachments.find(
      (a: any) => a.data && (a.name?.endsWith('.pptx') || a.name?.endsWith('.ppt') || a.name?.endsWith('.ppsx') || a.mime?.includes('presentation'))
    ) || attachments[0];

    if (!pptxAtt || !pptxAtt.data) {
      res.status(404).send('PPTX attachment not found in lesson content');
      return;
    }

    const base64Content = pptxAtt.data.includes(';base64,') ? pptxAtt.data.split(';base64,')[1] : pptxAtt.data;
    const fileBuffer = Buffer.from(base64Content, 'base64');
    const fileName = pptxAtt.name || 'presentation.pptx';

    res.setHeader('Content-Type', pptxAtt.mime || 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Content-Length', fileBuffer.length);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(fileBuffer);
  } catch (err: any) {
    res.status(500).send('Error reading presentation file');
  }
};

/**
 * GET /api/courses/attachment/:contentId/:attIdx/file
 * Serves raw file attachment (PDF, DOCX, etc.) as an inline HTTP binary stream
 */
export const getAttachmentFile = async (req: Request, res: Response) => {
  const contentId = String(req.params.contentId || '');
  const attIdx = String(req.params.attIdx || '0');
  const index = parseInt(attIdx, 10) || 0;

  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT attachments FROM lesson_contents WHERE id = ?',
      [contentId]
    );

    if (!rows || rows.length === 0 || !rows[0].attachments) {
      res.status(404).send('Attachment not found');
      return;
    }

    let attachments: any[] = [];
    try {
      attachments = typeof rows[0].attachments === 'string' ? JSON.parse(rows[0].attachments) : rows[0].attachments;
    } catch (e) {
      // fallback
    }

    const att = attachments[index] || attachments[0];

    if (!att || !att.data) {
      res.status(404).send('Attachment data not found');
      return;
    }

    const base64Content = att.data.includes(';base64,') ? att.data.split(';base64,')[1] : att.data;
    const fileBuffer = Buffer.from(base64Content, 'base64');
    const fileName = att.name || 'document';
    const ext = fileName.split('.').pop()?.toLowerCase() || '';

    let contentType = att.mime || 'application/octet-stream';
    if (ext === 'pdf') contentType = 'application/pdf';
    else if (['docx', 'doc'].includes(ext)) contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    else if (['pptx', 'ppt'].includes(ext)) contentType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    else if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) contentType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Content-Length', fileBuffer.length);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(fileBuffer);
  } catch (error: any) {
    console.error('Error serving attachment file:', error);
    res.status(500).send('Internal server error');
  }
};
