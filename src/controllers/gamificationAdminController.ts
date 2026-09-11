import { Request, Response } from 'express';
import pool from '../config/db';
import { RowDataPacket } from 'mysql2';
import { getActiveSeason, checkAndProcessSeasonExpiry } from '../services/seasonService';
import { getAllLevels } from '../services/levelService';

/**
 * GET /api/admin/leaderboard/analytics
 * Provides comprehensive data for rendering Leaderboard charts,
 * daily XP trends, activity distribution, and level demographics.
 */
export const getLeaderboardChartAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    await checkAndProcessSeasonExpiry();
    const activeSeason = await getActiveSeason();
    const seasonFilter = req.query.season_id && req.query.season_id !== 'all' ? Number(req.query.season_id) : null;
    const rangeDays = req.query.range === '7d' ? 7 : req.query.range === '90d' ? 90 : 30;

    // 1. Fetch configured gamification levels for mapping
    const levels = await getAllLevels();
    const levelMap = new Map<number, { name: string; badge_icon: string | null }>();
    levels.forEach(l => levelMap.set(l.level_number, { name: l.name, badge_icon: l.badge_icon }));

    // 2. Top 10 Ranked Students (Current Season XP)
    const [topStudentsRows] = await pool.query<RowDataPacket[]>(`
      SELECT u.id as user_id, u.full_name, u.email, u.avatar,
             COALESCE(us.xp, 0) as current_season_xp,
             COALESCE(us.level, 1) as level,
             COALESCE((SELECT SUM(xp) FROM xp_transactions WHERE user_id = u.id), 0) as all_time_xp,
             COALESCE(us.total_quiz, 0) as total_quiz,
             COALESCE(us.total_speaking, 0) as total_speaking,
             (SELECT COUNT(*) FROM certificates WHERE user_id = u.id AND status = 'ACTIVE') as certs_count
      FROM users u
      LEFT JOIN user_statistics us ON u.id = us.user_id
      WHERE u.role_id = 4
      ORDER BY current_season_xp DESC, all_time_xp DESC
      LIMIT 10
    `);

    const topStudents = topStudentsRows.map((s, idx) => {
      const lvlInfo = levelMap.get(Number(s.level)) || { name: `Level ${s.level}`, badge_icon: '⭐' };
      return {
        rank: idx + 1,
        userId: s.user_id,
        fullName: s.full_name,
        email: s.email,
        avatar: s.avatar,
        currentSeasonXp: Number(s.current_season_xp),
        allTimeXp: Number(s.all_time_xp),
        level: Number(s.level),
        levelName: lvlInfo.name,
        badgeIcon: lvlInfo.badge_icon,
        totalQuiz: Number(s.total_quiz),
        totalSpeaking: Number(s.total_speaking),
        certsCount: Number(s.certs_count)
      };
    });

    // 3. XP Breakdown by Activity Type (QUIZ, LESSON, SPEAKING, BONUS, etc.)
    const [activityRows] = await pool.query<RowDataPacket[]>(`
      SELECT activity_type,
             CAST(SUM(xp) AS SIGNED) as total_xp,
             COUNT(*) as transaction_count
      FROM xp_transactions
      ${seasonFilter ? 'WHERE season_id = ?' : ''}
      GROUP BY activity_type
      ORDER BY total_xp DESC
    `, seasonFilter ? [seasonFilter] : []);

    const totalXpAllActivities = activityRows.reduce((acc, cur) => acc + Number(cur.total_xp || 0), 0);
    const xpByActivity = activityRows.map(row => ({
      activityType: row.activity_type,
      totalXp: Number(row.total_xp || 0),
      transactionCount: Number(row.transaction_count || 0),
      percentage: totalXpAllActivities > 0
        ? Math.round((Number(row.total_xp || 0) / totalXpAllActivities) * 1000) / 10
        : 0
    }));

    // 4. Daily XP Trend over rangeDays (for Line / Area Chart)
    const [dailyTrendRows] = await pool.query<RowDataPacket[]>(`
      SELECT DATE_FORMAT(created_at, '%Y-%m-%d') as date,
             DATE_FORMAT(created_at, '%d %b') as label,
             CAST(SUM(xp) AS SIGNED) as daily_xp,
             COUNT(*) as activity_count
      FROM xp_transactions
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY date, label
      ORDER BY date ASC
    `, [rangeDays]);

    const dailyXpTrend = dailyTrendRows.map(row => ({
      date: row.date,
      label: row.label,
      dailyXp: Number(row.daily_xp || 0),
      activityCount: Number(row.activity_count || 0)
    }));

    // 5. Level Demographics Distribution (Students Count Per Level)
    const [levelDistRows] = await pool.query<RowDataPacket[]>(`
      SELECT COALESCE(us.level, 1) as level,
             COUNT(u.id) as student_count
      FROM users u
      LEFT JOIN user_statistics us ON u.id = us.user_id
      WHERE u.role_id = 4
      GROUP BY level
      ORDER BY level ASC
    `);

    const levelDistribution = levels.map(lvl => {
      const match = levelDistRows.find(r => Number(r.level) === lvl.level_number);
      return {
        levelNumber: lvl.level_number,
        levelName: lvl.name,
        badgeIcon: lvl.badge_icon,
        minXp: lvl.min_xp,
        studentCount: match ? Number(match.student_count) : 0
      };
    });

    // 6. XP Range Distribution Buckets (Histogram for Gamification Health)
    const [bucketsRows] = await pool.query<RowDataPacket[]>(`
      SELECT 
        COUNT(CASE WHEN COALESCE(us.xp, 0) = 0 THEN 1 END) as zero_xp,
        COUNT(CASE WHEN COALESCE(us.xp, 0) BETWEEN 1 AND 100 THEN 1 END) as xp_1_100,
        COUNT(CASE WHEN COALESCE(us.xp, 0) BETWEEN 101 AND 300 THEN 1 END) as xp_101_300,
        COUNT(CASE WHEN COALESCE(us.xp, 0) BETWEEN 301 AND 600 THEN 1 END) as xp_301_600,
        COUNT(CASE WHEN COALESCE(us.xp, 0) BETWEEN 601 AND 1000 THEN 1 END) as xp_601_1000,
        COUNT(CASE WHEN COALESCE(us.xp, 0) > 1000 THEN 1 END) as xp_above_1000
      FROM users u
      LEFT JOIN user_statistics us ON u.id = us.user_id
      WHERE u.role_id = 4
    `);

    const bucketData = bucketsRows[0] || {};
    const xpRangeDistribution = [
      { range: '0 XP (Belum Mulai)', count: Number(bucketData.zero_xp || 0), color: '#94A3B8' },
      { range: '1 - 100 XP', count: Number(bucketData.xp_1_100 || 0), color: '#38BDF8' },
      { range: '101 - 300 XP', count: Number(bucketData.xp_101_300 || 0), color: '#10B981' },
      { range: '301 - 600 XP', count: Number(bucketData.xp_301_600 || 0), color: '#F59E0B' },
      { range: '601 - 1000 XP', count: Number(bucketData.xp_601_1000 || 0), color: '#EC4899' },
      { range: '> 1000 XP', count: Number(bucketData.xp_above_1000 || 0), color: '#8B5CF6' }
    ];

    // 7. Overall Summary Stats
    const [overallRows] = await pool.query<RowDataPacket[]>(`
      SELECT 
        COUNT(u.id) as total_students,
        CAST(COALESCE(SUM(us.xp), 0) AS SIGNED) as total_season_xp,
        CAST(COALESCE(AVG(us.xp), 0) AS SIGNED) as avg_season_xp,
        CAST(COALESCE(MAX(us.xp), 0) AS SIGNED) as max_season_xp,
        (SELECT CAST(COALESCE(SUM(xp), 0) AS SIGNED) FROM xp_transactions) as total_all_time_xp
      FROM users u
      LEFT JOIN user_statistics us ON u.id = us.user_id
      WHERE u.role_id = 4
    `);

    const summary = {
      totalStudents: Number(overallRows[0]?.total_students || 0),
      totalSeasonXp: Number(overallRows[0]?.total_season_xp || 0),
      avgSeasonXp: Number(overallRows[0]?.avg_season_xp || 0),
      maxSeasonXp: Number(overallRows[0]?.max_season_xp || 0),
      totalAllTimeXp: Number(overallRows[0]?.total_all_time_xp || 0),
      activeSeason: activeSeason ? {
        id: activeSeason.id,
        title: activeSeason.title,
        code: activeSeason.code,
        startDate: activeSeason.start_date,
        endDate: activeSeason.end_date,
        resetScheduleType: activeSeason.reset_schedule_type
      } : null
    };

    res.json({
      summary,
      topStudents,
      xpByActivity,
      dailyXpTrend,
      levelDistribution,
      xpRangeDistribution
    });
  } catch (error: any) {
    console.error('Failed to get leaderboard chart analytics:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

/**
 * GET /api/admin/students/xp-stats
 * Returns paginated, searchable, sortable XP statistics per student
 * with breakdown of activity sources (Quiz, Speaking, Lesson, Bonus).
 */
export const getStudentsXpAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));
    const offset = (page - 1) * limit;
    const search = req.query.search ? String(req.query.search).trim() : '';
    const sortBy = req.query.sortBy ? String(req.query.sortBy).toLowerCase() : 'xp';
    const order = req.query.order && String(req.query.order).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Levels mapping
    const levels = await getAllLevels();
    const levelMap = new Map<number, { name: string; badge_icon: string | null }>();
    levels.forEach(l => levelMap.set(l.level_number, { name: l.name, badge_icon: l.badge_icon }));

    // Prepare filter query
    let whereClause = 'WHERE u.role_id = 4';
    const queryParams: any[] = [];

    if (search) {
      whereClause += ' AND (u.full_name LIKE ? OR u.email LIKE ?)';
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    // Determine ORDER BY column
    let orderBySql = 'current_season_xp DESC, all_time_xp DESC';
    if (sortBy === 'all_time_xp') {
      orderBySql = `all_time_xp ${order}`;
    } else if (sortBy === 'level') {
      orderBySql = `level ${order}, current_season_xp ${order}`;
    } else if (sortBy === 'name') {
      orderBySql = `u.full_name ${order}`;
    } else if (sortBy === 'xp') {
      orderBySql = `current_season_xp ${order}, all_time_xp ${order}`;
    }

    // 1. Total count query
    const [countRows] = await pool.query<RowDataPacket[]>(`
      SELECT COUNT(*) as total
      FROM users u
      ${whereClause}
    `, queryParams);
    const totalRecords = countRows[0]?.total || 0;

    // 2. Paginated students query with activity XP breakdowns
    const [studentRows] = await pool.query<RowDataPacket[]>(`
      SELECT u.id as user_id, u.full_name, u.email, u.avatar, u.created_at,
             COALESCE(us.xp, 0) as current_season_xp,
             COALESCE(us.level, 1) as level,
             COALESCE((SELECT SUM(xp) FROM xp_transactions WHERE user_id = u.id), 0) as all_time_xp,
             COALESCE(us.total_quiz, 0) as total_quiz,
             COALESCE(us.total_speaking, 0) as total_speaking,
             COALESCE(us.total_learning_minutes, 0) as total_learning_minutes,
             (SELECT COUNT(*) FROM certificates WHERE user_id = u.id AND status = 'ACTIVE') as certs_count,
             
             -- Breakdown of XP per activity from xp_transactions
             COALESCE((SELECT SUM(xp) FROM xp_transactions WHERE user_id = u.id AND activity_type = 'QUIZ'), 0) as xp_quiz,
             COALESCE((SELECT SUM(xp) FROM xp_transactions WHERE user_id = u.id AND activity_type = 'SPEAKING'), 0) as xp_speaking,
             COALESCE((SELECT SUM(xp) FROM xp_transactions WHERE user_id = u.id AND activity_type = 'LESSON'), 0) as xp_lesson,
             COALESCE((SELECT SUM(xp) FROM xp_transactions WHERE user_id = u.id AND activity_type = 'BONUS'), 0) as xp_bonus,
             COALESCE((SELECT SUM(xp) FROM xp_transactions WHERE user_id = u.id AND activity_type NOT IN ('QUIZ', 'SPEAKING', 'LESSON', 'BONUS')), 0) as xp_other,
             
             (SELECT MAX(created_at) FROM xp_transactions WHERE user_id = u.id) as last_activity_at
      FROM users u
      LEFT JOIN user_statistics us ON u.id = us.user_id
      ${whereClause}
      ORDER BY ${orderBySql}
      LIMIT ? OFFSET ?
    `, [...queryParams, limit, offset]);

    // Format rows with level names, badge icons, and ranks
    const students = studentRows.map((row, idx) => {
      const lvlInfo = levelMap.get(Number(row.level)) || { name: `Level ${row.level}`, badge_icon: '🌱' };
      return {
        rank: offset + idx + 1,
        userId: row.user_id,
        fullName: row.full_name,
        email: row.email,
        avatar: row.avatar,
        registeredAt: row.created_at,
        currentSeasonXp: Number(row.current_season_xp),
        allTimeXp: Number(row.all_time_xp),
        level: Number(row.level),
        levelName: lvlInfo.name,
        badgeIcon: lvlInfo.badge_icon,
        activityBreakdown: {
          quiz: Number(row.xp_quiz),
          speaking: Number(row.xp_speaking),
          lesson: Number(row.xp_lesson),
          bonus: Number(row.xp_bonus),
          other: Number(row.xp_other)
        },
        learningStats: {
          totalQuiz: Number(row.total_quiz),
          totalSpeaking: Number(row.total_speaking),
          learningMinutes: Number(row.total_learning_minutes),
          certsCount: Number(row.certs_count)
        },
        lastActivityAt: row.last_activity_at
      };
    });

    res.json({
      pagination: {
        total: totalRecords,
        page,
        limit,
        totalPages: Math.ceil(totalRecords / limit)
      },
      students
    });
  } catch (error: any) {
    console.error('Failed to get students XP analytics:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

/**
 * GET /api/admin/students/:userId/xp-history
 * Returns detailed XP transactions history and progression timeline for a specific student.
 */
export const getStudentXpDetailHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = Number(req.params.userId);
    if (!userId) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }

    // 1. Fetch student info
    const [userRows] = await pool.query<RowDataPacket[]>(`
      SELECT u.id, u.full_name, u.email, u.avatar, u.status, u.created_at,
             COALESCE(us.xp, 0) as current_season_xp,
             COALESCE(us.level, 1) as level,
             COALESCE(us.total_learning_minutes, 0) as total_learning_minutes,
             COALESCE(us.total_quiz, 0) as total_quiz,
             COALESCE(us.total_speaking, 0) as total_speaking,
             (SELECT COUNT(*) FROM certificates WHERE user_id = u.id AND status = 'ACTIVE') as certs_count
      FROM users u
      LEFT JOIN user_statistics us ON u.id = us.user_id
      WHERE u.id = ? AND u.role_id = 4
    `, [userId]);

    if (!userRows || userRows.length === 0) {
      res.status(404).json({ error: 'Siswa tidak ditemukan' });
      return;
    }

    const student = userRows[0];

    // 2. Fetch level info
    const levels = await getAllLevels();
    const currentLevel = levels.find(l => l.level_number === Number(student.level));

    // 3. Transactions breakdown by activity
    const [activityBreakdownRows] = await pool.query<RowDataPacket[]>(`
      SELECT activity_type,
             CAST(SUM(xp) AS SIGNED) as total_xp,
             COUNT(*) as count
      FROM xp_transactions
      WHERE user_id = ?
      GROUP BY activity_type
      ORDER BY total_xp DESC
    `, [userId]);

    // 4. Detailed transaction logs (last 50)
    const [transactions] = await pool.query<RowDataPacket[]>(`
      SELECT id, season_id, activity_type, reference_id, xp, description, created_at
      FROM xp_transactions
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `, [userId]);

    // 5. Past seasons archived records
    const [pastSeasons] = await pool.query<RowDataPacket[]>(`
      SELECT h.*, s.title as season_title, s.code as season_code
      FROM leaderboard_season_history h
      JOIN leaderboard_seasons s ON h.season_id = s.id
      WHERE h.user_id = ?
      ORDER BY s.id DESC
    `, [userId]);

    res.json({
      student: {
        id: student.id,
        fullName: student.full_name,
        email: student.email,
        avatar: student.avatar,
        status: student.status,
        joinedAt: student.created_at,
        currentSeasonXp: Number(student.current_season_xp),
        level: Number(student.level),
        levelName: currentLevel?.name || `Level ${student.level}`,
        badgeIcon: currentLevel?.badge_icon || '🌱',
        learningStats: {
          learningMinutes: Number(student.total_learning_minutes),
          quizCount: Number(student.total_quiz),
          speakingCount: Number(student.total_speaking),
          certsCount: Number(student.certs_count)
        }
      },
      activityBreakdown: activityBreakdownRows.map(r => ({
        activityType: r.activity_type,
        totalXp: Number(r.total_xp),
        count: Number(r.count)
      })),
      transactions,
      pastSeasons
    });
  } catch (error: any) {
    console.error('Failed to get student XP history:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
