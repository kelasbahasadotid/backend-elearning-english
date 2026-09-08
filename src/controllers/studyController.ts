import { Response } from 'express';
import pool from '../config/db';
import { AuthRequest } from '../middleware/auth';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { addXpTransaction } from '../utils/xp';
import { updateProgressHelper, checkSequentialLessonLock } from '../utils/progress';
import { getActiveSeason, checkAndProcessSeasonExpiry } from '../services/seasonService';
import { getAllLevels } from '../services/levelService';

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
    let quizSessions: any[] = [];
    let speakingProgress: any = null;

    if (assessmentId) {
      const [apRows] = await pool.query<RowDataPacket[]>(
        'SELECT highest_score, total_attempt, passed FROM assessment_progress WHERE user_id = ? AND assessment_id = ?',
        [req.user.id, assessmentId]
      );
      assessmentProgress = apRows[0] || null;

      // Fetch all quiz sessions (attempts) for this assessment and user
      const [sessionRows] = await pool.query<RowDataPacket[]>(
        `SELECT id as attempt_id, started_at, submitted_at, duration_seconds, score, 
                total_correct, total_wrong, total_unanswered, percentage, passed, status, created_at
         FROM assessment_attempts 
         WHERE user_id = ? AND assessment_id = ? 
         ORDER BY id DESC`,
        [req.user.id, assessmentId]
      );
      quizSessions = sessionRows;
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
      quizSessions,
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
    await checkAndProcessSeasonExpiry();
    const activeSeason = await getActiveSeason();
    const levels = await getAllLevels();
    const levelMap = new Map<number, { name: string; badge_icon: string | null }>();
    levels.forEach(l => levelMap.set(l.level_number, { name: l.name, badge_icon: l.badge_icon }));

    const [ranks] = await pool.query<RowDataPacket[]>(
      `SELECT u.id, u.full_name, u.email, u.avatar, COALESCE(us.xp, 0) as xp, COALESCE(us.level, 1) as level,
              (SELECT COUNT(*) FROM enrollments WHERE user_id = u.id AND status = 'ACTIVE') as coursesCount,
              (SELECT COUNT(*) FROM certificates WHERE user_id = u.id AND status = 'ACTIVE') as certsCount
       FROM users u
       LEFT JOIN user_statistics us ON u.id = us.user_id
       WHERE u.role_id = 4
       ORDER BY xp DESC, level DESC
       LIMIT 50`
    );

    const now = new Date();
    const endDate = activeSeason ? new Date(activeSeason.end_date) : null;
    const remainingDays = endDate ? Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0;

    const enrichedRanks = ranks.map((r: any, idx: number) => {
      const lvlInfo = levelMap.get(Number(r.level)) || { name: `Level ${r.level}`, badge_icon: '⭐' };
      return {
        ...r,
        rank: idx + 1,
        level_name: lvlInfo.name,
        badge_icon: lvlInfo.badge_icon,
        season_id: activeSeason?.id,
        season_title: activeSeason?.title,
        season_end_date: activeSeason?.end_date,
        season_days_left: remainingDays
      };
    });

    if (req.query.format === 'rich') {
      res.json({
        season: activeSeason,
        remainingDays,
        rankings: enrichedRanks
      });
      return;
    }

    res.json(enrichedRanks);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const getActiveSeasonInfo = async (req: AuthRequest, res: Response) => {
  try {
    await checkAndProcessSeasonExpiry();
    const activeSeason = await getActiveSeason();
    const now = new Date();
    const endDate = new Date(activeSeason.end_date);
    const diffMs = Math.max(0, endDate.getTime() - now.getTime());
    const remainingDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const remainingHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    res.json({
      season: activeSeason,
      remainingDays,
      remainingHours,
      isExpired: diffMs <= 0
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const getPublicLevels = async (req: AuthRequest, res: Response) => {
  try {
    const levels = await getAllLevels();
    res.json(levels);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

/**
 * Get personal season history for logged-in student (Riwayat Season Saya)
 */
export const getMySeasonHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // 1. Fetch completed season history for this student
    const [historyRows] = await pool.query<RowDataPacket[]>(`
      SELECT h.id, h.season_id, h.final_rank, h.final_xp, h.final_level, h.level_name, h.created_at,
             s.title as season_title,
             s.code as season_code,
             s.start_date,
             s.end_date,
             s.status as season_status,
             (SELECT COUNT(*) FROM leaderboard_season_history WHERE season_id = s.id) as total_participants
      FROM leaderboard_season_history h
      JOIN leaderboard_seasons s ON h.season_id = s.id
      WHERE h.user_id = ?
      ORDER BY s.id DESC
    `, [userId]);

    // 2. Fetch current active season standing
    await checkAndProcessSeasonExpiry();
    const activeSeason = await getActiveSeason();
    let currentSeasonStanding: any = null;

    if (activeSeason) {
      const [currentStats] = await pool.query<RowDataPacket[]>(
        'SELECT xp, level FROM user_statistics WHERE user_id = ?',
        [userId]
      );
      const studentXp = Number(currentStats[0]?.xp || 0);
      const studentLevel = Number(currentStats[0]?.level || 1);

      // Rank among all students in current season
      const [rankRows] = await pool.query<RowDataPacket[]>(`
        SELECT COUNT(*) + 1 as current_rank
        FROM user_statistics us
        JOIN users u ON us.user_id = u.id
        WHERE u.role_id = 4 AND us.xp > ?
      `, [studentXp]);

      const [totalActiveRows] = await pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) as total FROM users WHERE role_id = 4 AND status = "ACTIVE"'
      );

      const now = new Date();
      const endDate = new Date(activeSeason.end_date);
      const remainingDays = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

      currentSeasonStanding = {
        season: activeSeason,
        xp: studentXp,
        level: studentLevel,
        currentRank: rankRows[0]?.current_rank || 1,
        totalParticipants: totalActiveRows[0]?.total || 0,
        remainingDays
      };
    }

    // 3. Calculate career statistics
    const totalSeasons = historyRows.length;
    const bestRank = totalSeasons > 0 ? historyRows.reduce((min, cur) => cur.final_rank < min ? cur.final_rank : min, historyRows[0].final_rank) : null;
    const podiumCount = historyRows.filter(h => h.final_rank <= 3).length;
    const totalArchivedXp = historyRows.reduce((sum, cur) => sum + Number(cur.final_xp || 0), 0);

    const enrichedHistory = historyRows.map(h => {
      let medal = '🎖️';
      let badgeTitle = 'Participant';
      if (h.final_rank === 1) {
        medal = '🥇';
        badgeTitle = 'Gold Champion (Juara 1)';
      } else if (h.final_rank === 2) {
        medal = '🥈';
        badgeTitle = 'Silver Runner-Up (Juara 2)';
      } else if (h.final_rank === 3) {
        medal = '🥉';
        badgeTitle = 'Bronze Podium (Juara 3)';
      } else if (h.final_rank <= 10) {
        medal = '⭐';
        badgeTitle = 'Top 10 Finisher';
      }

      return {
        ...h,
        medal,
        badge_title: badgeTitle
      };
    });

    res.json({
      summary: {
        totalSeasonsParticipated: totalSeasons,
        bestRank,
        podiumCount,
        totalArchivedXp
      },
      currentSeasonStanding,
      history: enrichedHistory
    });
  } catch (error: any) {
    console.error('Failed to get student season history:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

/**
 * Get public leaderboard of an archived past season
 */
export const getPastSeasonLeaderboard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const seasonId = Number(req.params.id);
    if (!seasonId) {
      res.status(400).json({ error: 'Invalid season ID' });
      return;
    }

    const [seasonRows] = await pool.query<RowDataPacket[]>(
      'SELECT id, title, code, start_date, end_date, reset_schedule_type, status FROM leaderboard_seasons WHERE id = ?',
      [seasonId]
    );

    if (!seasonRows || seasonRows.length === 0) {
      res.status(404).json({ error: 'Season not found' });
      return;
    }

    const [historyRows] = await pool.query<RowDataPacket[]>(`
      SELECT h.id, h.season_id, h.user_id, h.final_rank, h.final_xp, h.final_level, h.level_name, h.created_at,
             u.full_name, u.email, u.avatar
      FROM leaderboard_season_history h
      JOIN users u ON h.user_id = u.id
      WHERE h.season_id = ?
      ORDER BY h.final_rank ASC
    `, [seasonId]);

    const podium = historyRows.slice(0, 3).map((item, idx) => ({
      ...item,
      medal: idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉',
      badge_title: idx === 0 ? 'Gold Champion' : idx === 1 ? 'Silver Runner-Up' : 'Bronze Podium'
    }));

    res.json({
      season: seasonRows[0],
      totalParticipants: historyRows.length,
      podium,
      rankings: historyRows
    });
  } catch (error: any) {
    console.error('Failed to get past season leaderboard:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

/**
 * Get comprehensive learning progress for authenticated student
 * Includes enrolled courses, completed modules, and full table of completed quiz sessions (attempts)
 */
export const getMyProgressSummary = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const userId = req.user.id;

    // 1. Enrolled courses with overall progress
    const [courses] = await pool.query<RowDataPacket[]>(
      `SELECT e.course_id, c.title as course_title, c.slug as course_slug,
              COALESCE(cp.overall_progress, 0) as overall_progress,
              COALESCE(cp.completed_module, 0) as completed_module,
              COALESCE(cp.total_module, 0) as total_module,
              COALESCE(cp.certificate_ready, 0) as certificate_ready
       FROM enrollments e
       JOIN courses c ON e.course_id = c.id
       LEFT JOIN course_progress cp ON c.id = cp.course_id AND cp.user_id = ?
       WHERE e.user_id = ? AND (e.status = 'ACTIVE' OR LOWER(e.status) = 'active')`,
      [userId, userId]
    );

    // 2. All quiz sessions completed by this student
    const [quizSessions] = await pool.query<RowDataPacket[]>(
      `SELECT aa.id as attempt_id, aa.assessment_id, 
              a.title as quiz_title, a.passing_score,
              l.id as lesson_id, l.title as lesson_title,
              c.id as course_id, c.title as course_title, c.slug as course_slug,
              aa.score, aa.percentage, aa.passed, 
              aa.total_correct, aa.total_wrong, aa.total_unanswered,
              aa.duration_seconds, aa.status, aa.started_at, aa.submitted_at
       FROM assessment_attempts aa
       JOIN assessments a ON aa.assessment_id = a.id
       LEFT JOIN lessons l ON a.lesson_id = l.id
       LEFT JOIN courses c ON a.course_id = c.id
       WHERE aa.user_id = ?
       ORDER BY aa.submitted_at DESC`,
      [userId]
    );

    // 3. Quiz statistics calculation
    const totalAttempts = quizSessions.length;
    const passedAttempts = quizSessions.filter((s: any) => s.passed === 1 || s.passed === true).length;
    const avgScore = totalAttempts > 0 
      ? Number((quizSessions.reduce((acc: number, s: any) => acc + Number(s.percentage || 0), 0) / totalAttempts).toFixed(1))
      : 0;
    const highestScore = totalAttempts > 0
      ? Math.max(...quizSessions.map((s: any) => Number(s.percentage || 0)))
      : 0;

    res.json({
      userId,
      courses,
      quiz_sessions: quizSessions,
      quizSessions, // camelCase alias for convenience
      quizStats: {
        totalAttempts,
        passedAttempts,
        failedAttempts: totalAttempts - passedAttempts,
        averageScore: avgScore,
        highestScore
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};



