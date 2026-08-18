import { Response } from 'express';
import pool from '../config/db';
import { AuthRequest } from '../middleware/auth';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { addXpTransaction } from '../utils/xp';
import { updateProgressHelper, checkSequentialLessonLock } from '../utils/progress';

export const getLesson = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  if (!req.user) {
     res.status(401).json({ error: 'Unauthorized' });
     return;
  }

  try {
    // 1. Fetch lesson details (including max_attempt)
    const [lessons] = await pool.query<RowDataPacket[]>(
      `SELECT l.id, l.module_id, l.title, l.lesson_type, l.xp_reward, 
              COALESCE(a.max_attempt, l.max_attempt) as max_attempt
       FROM lessons l
       LEFT JOIN assessments a ON l.id = a.lesson_id
       WHERE l.id = ? AND l.status = "PUBLISHED"`,
      [id]
    );

    if (lessons.length === 0) {
       res.status(404).json({ error: 'Lesson not found' });
       return;
    }

    const lesson = lessons[0];

    // Verify user is enrolled in the course containing this module/lesson (or bypass if Admin/Tutor/Manager)
    const userRoleNum = Number(req.user.roleId || (req.user as any).role_id || (req.user as any).role || 4);
    const isAdminOrTutor = userRoleNum === 1 || userRoleNum === 2 || userRoleNum === 3 || userRoleNum === 5;

    if (!isAdminOrTutor) {
      const [enrollments] = await pool.query<RowDataPacket[]>(
        `SELECT e.id 
         FROM enrollments e
         JOIN course_versions cv ON e.course_id = cv.course_id
         JOIN modules m ON cv.id = m.course_version_id
         WHERE m.id = ? AND e.user_id = ? AND (e.status = 'ACTIVE' OR LOWER(e.status) = 'active') AND (e.expired_at IS NULL OR e.expired_at >= NOW())`,
        [lesson.module_id, req.user.id]
      );

      if (enrollments.length === 0) {
         res.status(403).json({ error: 'You are not enrolled in this course' });
         return;
      }

      // Sequential lock check: lessons must be learned and completed in order
      const lockCheck = await checkSequentialLessonLock(pool, req.user.id, lesson.id);
      if (lockCheck.isLocked) {
        res.status(403).json({
          error: `Materi "${lesson.title}" masih terkunci. Anda harus menyelesaikan materi "${lockCheck.requiredLessonTitle}" terlebih dahulu sesuai urutan.`,
          isLocked: true,
          requiredLessonId: lockCheck.requiredLessonId,
          requiredLessonTitle: lockCheck.requiredLessonTitle
        });
        return;
      }
    }

    // 2. Fetch lesson contents (including parsed attachments for student view)
    const [contentsRaw] = await pool.query<RowDataPacket[]>(
      'SELECT id, content_type, title, description, content_order, estimated_minutes, attachments FROM lesson_contents WHERE lesson_id = ? AND (status IS NULL OR status = "" OR status IN ("ACTIVE", "PUBLISHED")) ORDER BY content_order ASC',
      [lesson.id]
    );
    // Parse attachments JSON; strip raw base64 data (send full data for inline view)
    const parsedContents = (contentsRaw as any[]).map((c: any) => ({
      ...c,
      attachments: c.attachments ? (() => { try { return JSON.parse(c.attachments); } catch(_) { return []; } })() : []
    }));

    // Fetch exact H5P materials attached to this lesson from h5p_contents (source of truth)
    const [h5pRows] = await pool.query<RowDataPacket[]>(
      'SELECT id, title, params_json FROM h5p_contents WHERE lesson_id = ? AND status = "PUBLISHED" ORDER BY id ASC',
      [lesson.id]
    );

    let contents: any[] = [];
    if (h5pRows.length > 0) {
      // Exclude any previous H5P or slide JSON entries from lesson_contents to avoid duplicates
      const nonH5pContents = parsedContents.filter((c: any) => 
        c.content_type !== 'H5P' && 
        !c.title?.startsWith('H5P:') && 
        !(typeof c.description === 'string' && c.description.includes('"slides"'))
      );
      
      const formattedH5p = (h5pRows as any[]).map((h5p: any, idx: number) => ({
        id: 90000 + h5p.id,
        content_type: 'H5P',
        title: `H5P: ${h5p.title}`,
        description: h5p.params_json,
        content_order: nonH5pContents.length + idx + 1,
        estimated_minutes: 15,
        attachments: [{ type: 'h5p', h5p_id: h5p.id }]
      }));
      contents = [...nonH5pContents, ...formattedH5p];
    } else {
      contents = parsedContents;
    }


    // 3. Fetch user progress for this lesson
    const [progress] = await pool.query<RowDataPacket[]>(
      'SELECT started_at, completed_at, progress_percent, completed FROM lesson_progress WHERE user_id = ? AND lesson_id = ?',
      [req.user.id, lesson.id]
    );

    let userProgress: any = progress[0] || null;
    
    // If progress entry doesn't exist, create it as started
    if (!userProgress) {
      await pool.query(
        'INSERT INTO lesson_progress (user_id, lesson_id, started_at, progress_percent, completed) VALUES (?, ?, NOW(), 0.00, 0)',
        [req.user.id, lesson.id]
      );
      userProgress = { started_at: new Date(), completed_at: null, progress_percent: 0, completed: 0 };
    }

    // 4. Fetch the course slug associated with this lesson's module
    const [courses] = await pool.query<RowDataPacket[]>(
      `SELECT c.slug
       FROM courses c
       JOIN course_versions cv ON c.id = cv.course_id
       JOIN modules m ON cv.id = m.course_version_id
       WHERE m.id = ?`,
      [lesson.module_id]
    );
    const courseSlug = courses[0]?.slug || 'english-beginner-speaking';

    let assessmentId: number | null = null;
    let speakingTestId: number | null = null;

    if (['QUIZ', 'EXAM'].includes(lesson.lesson_type)) {
      const [assessList] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM assessments WHERE lesson_id = ? AND status = "PUBLISHED" LIMIT 1',
        [lesson.id]
      );
      assessmentId = assessList[0]?.id || null;
    } else if (lesson.lesson_type === 'SPEAKING') {
      const [testList] = await pool.query<RowDataPacket[]>(
        `SELECT st.id 
         FROM speaking_tests st
         JOIN assessments a ON st.assessment_id = a.id
         WHERE a.lesson_id = ? AND a.status = "PUBLISHED" LIMIT 1`,
        [lesson.id]
      );
      speakingTestId = testList[0]?.id || null;
    }

    let assessmentProgress: any = null;
    let speakingProgress: any = null;

    if (assessmentId) {
      const [apRows] = await pool.query<RowDataPacket[]>(
        'SELECT highest_score, total_attempt, passed FROM assessment_progress WHERE user_id = ? AND assessment_id = ?',
        [req.user.id, assessmentId]
      );
      assessmentProgress = apRows[0] || null;
    }

    if (speakingTestId) {
      const [saRows] = await pool.query<RowDataPacket[]>(
        `SELECT MAX(overall_score) as highest_score, COUNT(*) as total_attempt, 
                IF(MAX(overall_score) >= 60.00, 1, 0) as passed
         FROM speaking_attempts 
         WHERE user_id = ? AND speaking_test_id = ?`,
        [req.user.id, speakingTestId]
      );
      speakingProgress = saRows[0]?.total_attempt > 0 ? saRows[0] : null;
    }

    res.json({
      lesson: {
        ...lesson,
        completed: Boolean(userProgress?.completed === 1 || userProgress?.completed === true)
      },
      contents,
      progress: userProgress,
      courseSlug,
      assessmentId,
      speakingTestId,
      assessmentProgress,
      speakingProgress
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const updateVideoProgress = async (req: AuthRequest, res: Response) => {
  const { lessonContentId, watchedSeconds, durationSeconds, completed } = req.body;
  if (!req.user) {
     res.status(401).json({ error: 'Unauthorized' });
     return;
  }

  if (!lessonContentId || watchedSeconds === undefined || !durationSeconds) {
     res.status(400).json({ error: 'lessonContentId, watchedSeconds, and durationSeconds are required' });
     return;
  }

  try {
    // Check if progress exists
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM video_progress WHERE user_id = ? AND lesson_content_id = ?',
      [req.user.id, lessonContentId]
    );

    if (existing.length > 0) {
      await pool.query(
        'UPDATE video_progress SET watched_seconds = ?, duration_seconds = ?, last_position = ?, completed = ? WHERE user_id = ? AND lesson_content_id = ?',
        [watchedSeconds, durationSeconds, watchedSeconds, completed ? 1 : 0, req.user.id, lessonContentId]
      );
    } else {
      await pool.query(
        'INSERT INTO video_progress (user_id, lesson_content_id, watched_seconds, duration_seconds, last_position, completed) VALUES (?, ?, ?, ?, ?, ?)',
        [req.user.id, lessonContentId, watchedSeconds, durationSeconds, watchedSeconds, completed ? 1 : 0]
      );
    }

    res.json({ message: 'Video progress updated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const updateLessonProgress = async (req: AuthRequest, res: Response) => {
  const { lessonId, completed, progressPercent } = req.body;
  if (!req.user) {
     res.status(401).json({ error: 'Unauthorized' });
     return;
  }

  if (!lessonId) {
     res.status(400).json({ error: 'lessonId is required' });
     return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const result = await updateProgressHelper(
      connection,
      req.user.id,
      lessonId,
      completed,
      progressPercent
    );

    await connection.commit();
    res.json({
      message: 'Progress updated successfully',
      lesson: { lessonId, completed, progressPercent },
      module: result ? {
        moduleId: result.moduleId,
        completedLesson: result.completedLessons,
        totalLesson: result.totalLessons,
        progressPercent: result.moduleProgressPercent
      } : null,
      course: result ? {
        courseId: result.courseId,
        overallProgress: result.courseProgressPercent
      } : null,
      awardXp: result ? result.awardXp : false
    });
  } catch (error: any) {
    await connection.rollback();
    res.status(500).json({ error: error.message || 'Internal server error' });
  } finally {
    connection.release();
  }
};

export const toggleBookmark = async (req: AuthRequest, res: Response) => {
  const { id } = req.params; // lessonId
  if (!req.user) {
     res.status(401).json({ error: 'Unauthorized' });
     return;
  }

  try {
    // Check if table lesson_bookmarks exists (auto-create if missing)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS lesson_bookmarks (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT UNSIGNED NOT NULL,
        lesson_id BIGINT UNSIGNED NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY (user_id, lesson_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Check if bookmark exists
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM lesson_bookmarks WHERE user_id = ? AND lesson_id = ?',
      [req.user.id, id]
    );

    if (existing.length > 0) {
      // Remove bookmark
      await pool.query(
        'DELETE FROM lesson_bookmarks WHERE user_id = ? AND lesson_id = ?',
        [req.user.id, id]
      );
      res.json({ message: 'Bookmark removed successfully', bookmarked: false });
    } else {
      // Add bookmark
      await pool.query(
        'INSERT INTO lesson_bookmarks (user_id, lesson_id) VALUES (?, ?)',
        [req.user.id, id]
      );
      res.json({ message: 'Bookmark added successfully', bookmarked: true });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const getBookmarkedLessons = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
     res.status(401).json({ error: 'Unauthorized' });
     return;
  }

  try {
    // Ensure table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS lesson_bookmarks (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT UNSIGNED NOT NULL,
        lesson_id BIGINT UNSIGNED NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY (user_id, lesson_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    const [bookmarks] = await pool.query<RowDataPacket[]>(
      `SELECT lb.lesson_id, l.title as lesson_title, l.lesson_type, l.module_id, c.title as course_title, c.slug as course_slug
       FROM lesson_bookmarks lb
       JOIN lessons l ON lb.lesson_id = l.id
       JOIN modules m ON l.module_id = m.id
       JOIN course_versions cv ON m.course_version_id = cv.id
       JOIN courses c ON cv.course_id = c.id
       WHERE lb.user_id = ?
       ORDER BY lb.created_at DESC`,
      [req.user.id]
    );

    res.json(bookmarks);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const getLeaderboard = async (req: AuthRequest, res: Response) => {
  try {
    const [ranks] = await pool.query<RowDataPacket[]>(
      `SELECT u.id, u.full_name, u.email, COALESCE(us.xp, 0) as xp, COALESCE(us.level, 1) as level,
              (SELECT COUNT(*) FROM enrollments WHERE user_id = u.id AND status = 'ACTIVE') as coursesCount,
              (SELECT COUNT(*) FROM certificates WHERE user_id = u.id AND status = 'ACTIVE') as certsCount
       FROM users u
       LEFT JOIN user_statistics us ON u.id = us.user_id
       WHERE u.role_id = 4
       ORDER BY xp DESC, level DESC
       LIMIT 50`
    );
    res.json(ranks);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
