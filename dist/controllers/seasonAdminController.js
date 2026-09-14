"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStudentSeasonHistoryAdmin = exports.getSeasonHistory = exports.manualResetSeason = exports.updateActiveSeasonSchedule = exports.getCurrentSeason = exports.getSeasons = void 0;
const db_1 = __importDefault(require("../config/db"));
const seasonService_1 = require("../services/seasonService");
/**
 * Get list of all seasons with participant/archive stats
 */
const getSeasons = async (req, res) => {
    try {
        // Check if current season needs auto-reset before returning
        await (0, seasonService_1.checkAndProcessSeasonExpiry)();
        const [seasons] = await db_1.default.query(`
      SELECT s.*, 
        (SELECT COUNT(*) FROM leaderboard_season_history WHERE season_id = s.id) as archived_participants
      FROM leaderboard_seasons s
      ORDER BY s.id DESC
    `);
        const activeSeason = seasons.find((s) => s.status === 'ACTIVE');
        res.json({
            activeSeason: activeSeason || null,
            seasons
        });
    }
    catch (error) {
        console.error('Failed to get seasons:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
};
exports.getSeasons = getSeasons;
/**
 * Get active season details & countdown
 */
const getCurrentSeason = async (req, res) => {
    try {
        await (0, seasonService_1.checkAndProcessSeasonExpiry)();
        const activeSeason = await (0, seasonService_1.getActiveSeason)();
        const now = new Date();
        const endDate = new Date(activeSeason.end_date);
        const diffMs = Math.max(0, endDate.getTime() - now.getTime());
        const remainingDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const remainingHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        // Active students count in current season
        const [countRows] = await db_1.default.query('SELECT COUNT(*) as count FROM users WHERE role_id = 4 AND status = "ACTIVE"');
        res.json({
            season: activeSeason,
            countdown: {
                remainingMs: diffMs,
                remainingDays,
                remainingHours,
                isExpired: diffMs <= 0
            },
            totalStudents: countRows[0]?.count || 0
        });
    }
    catch (error) {
        console.error('Failed to get current season:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
};
exports.getCurrentSeason = getCurrentSeason;
/**
 * Update schedule / settings of the active season
 */
const updateActiveSeasonSchedule = async (req, res) => {
    try {
        const { title, start_date, end_date, reset_schedule_type } = req.body;
        const activeSeason = await (0, seasonService_1.getActiveSeason)();
        if (!activeSeason) {
            res.status(404).json({ error: 'Tidak ada season yang sedang aktif' });
            return;
        }
        const updates = [];
        const values = [];
        if (title) {
            updates.push('title = ?');
            values.push(title);
        }
        if (start_date) {
            updates.push('start_date = ?');
            values.push(new Date(start_date));
        }
        if (end_date) {
            updates.push('end_date = ?');
            values.push(new Date(end_date));
        }
        if (reset_schedule_type) {
            updates.push('reset_schedule_type = ?');
            values.push(reset_schedule_type);
        }
        if (updates.length > 0) {
            values.push(activeSeason.id);
            await db_1.default.query(`UPDATE leaderboard_seasons SET ${updates.join(', ')} WHERE id = ?`, values);
        }
        const updated = await (0, seasonService_1.getActiveSeason)();
        res.json({
            message: 'Jadwal season berhasil diperbarui',
            season: updated
        });
    }
    catch (error) {
        console.error('Failed to update season schedule:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
};
exports.updateActiveSeasonSchedule = updateActiveSeasonSchedule;
/**
 * Manual reset trigger by Admin
 */
const manualResetSeason = async (req, res) => {
    try {
        const { title, code, reset_schedule_type, start_date, end_date } = req.body;
        const result = await (0, seasonService_1.resetSeasonManually)({
            title,
            code,
            reset_schedule_type,
            start_date,
            end_date
        });
        res.json({
            message: 'Season Leaderboard berhasil di-reset secara manual. Seluruh XP siswa telah di-reset ke 0.',
            data: result
        });
    }
    catch (error) {
        console.error('Failed to manually reset season:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
};
exports.manualResetSeason = manualResetSeason;
/**
 * View ranking history of a completed season
 */
/**
 * View detailed ranking history of a specific season (with podium & analytics)
 */
const getSeasonHistory = async (req, res) => {
    try {
        const seasonId = Number(req.params.id);
        if (!seasonId) {
            res.status(400).json({ error: 'Invalid season ID' });
            return;
        }
        const [seasonRows] = await db_1.default.query('SELECT * FROM leaderboard_seasons WHERE id = ?', [seasonId]);
        if (!seasonRows || seasonRows.length === 0) {
            res.status(404).json({ error: 'Season not found' });
            return;
        }
        const season = seasonRows[0];
        // Fetch all ranking rows for this season
        const [historyRows] = await db_1.default.query(`
      SELECT h.id, h.season_id, h.user_id, h.final_rank, h.final_xp, h.final_level, h.level_name, h.created_at,
             u.full_name, u.email, u.avatar
      FROM leaderboard_season_history h
      JOIN users u ON h.user_id = u.id
      WHERE h.season_id = ?
      ORDER BY h.final_rank ASC
    `, [seasonId]);
        const totalParticipants = historyRows.length;
        const topXp = totalParticipants > 0 ? historyRows[0].final_xp : 0;
        const totalXpSum = historyRows.reduce((acc, cur) => acc + Number(cur.final_xp || 0), 0);
        const averageXp = totalParticipants > 0 ? Math.round(totalXpSum / totalParticipants) : 0;
        // Podium top 3
        const podium = historyRows.slice(0, 3).map((item, idx) => ({
            ...item,
            medal: idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉',
            badge_title: idx === 0 ? 'Gold Champion' : idx === 1 ? 'Silver Runner-Up' : 'Bronze Podium'
        }));
        res.json({
            season,
            stats: {
                totalParticipants,
                topXp,
                averageXp
            },
            podium,
            rankings: historyRows
        });
    }
    catch (error) {
        console.error('Failed to get season history:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
};
exports.getSeasonHistory = getSeasonHistory;
/**
 * View season history of a specific student (for Admin)
 */
const getStudentSeasonHistoryAdmin = async (req, res) => {
    try {
        const userId = Number(req.params.userId);
        if (!userId) {
            res.status(400).json({ error: 'Invalid user ID' });
            return;
        }
        // Check student existence
        const [userRows] = await db_1.default.query('SELECT id, full_name, email, avatar, role_id FROM users WHERE id = ?', [userId]);
        if (!userRows || userRows.length === 0) {
            res.status(404).json({ error: 'User tidak ditemukan' });
            return;
        }
        const student = userRows[0];
        // Query all past season participation
        const [historyRows] = await db_1.default.query(`
      SELECT h.*,
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
        // Current active season standing
        const activeSeason = await (0, seasonService_1.getActiveSeason)();
        let currentSeasonStanding = null;
        if (activeSeason) {
            const [currentStats] = await db_1.default.query('SELECT xp, level FROM user_statistics WHERE user_id = ?', [userId]);
            const [rankRows] = await db_1.default.query(`
        SELECT COUNT(*) + 1 as current_rank
        FROM user_statistics us
        JOIN users u ON us.user_id = u.id
        WHERE u.role_id = 4 AND us.xp > ?
      `, [Number(currentStats[0]?.xp || 0)]);
            currentSeasonStanding = {
                season: activeSeason,
                xp: Number(currentStats[0]?.xp || 0),
                level: Number(currentStats[0]?.level || 1),
                currentRank: rankRows[0]?.current_rank || 1
            };
        }
        // Summary statistics
        const totalSeasonsParticipated = historyRows.length;
        const bestRank = historyRows.reduce((min, cur) => cur.final_rank < min ? cur.final_rank : min, totalSeasonsParticipated > 0 ? historyRows[0].final_rank : 0);
        const podiumCount = historyRows.filter(h => h.final_rank <= 3).length;
        res.json({
            student,
            currentSeasonStanding,
            stats: {
                totalSeasonsParticipated,
                bestRank: totalSeasonsParticipated > 0 ? bestRank : null,
                podiumCount
            },
            history: historyRows.map(h => ({
                ...h,
                medal: h.final_rank === 1 ? '🥇' : h.final_rank === 2 ? '🥈' : h.final_rank === 3 ? '🥉' : h.final_rank <= 10 ? '⭐' : '🎖️'
            }))
        });
    }
    catch (error) {
        console.error('Failed to get student season history:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
};
exports.getStudentSeasonHistoryAdmin = getStudentSeasonHistoryAdmin;
