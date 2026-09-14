"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActiveSeason = getActiveSeason;
exports.calculateNextDates = calculateNextDates;
exports.executeSeasonReset = executeSeasonReset;
exports.checkAndProcessSeasonExpiry = checkAndProcessSeasonExpiry;
exports.resetSeasonManually = resetSeasonManually;
exports.initSeasonScheduler = initSeasonScheduler;
const db_1 = __importDefault(require("../config/db"));
const levelService_1 = require("./levelService");
/**
 * Get or create the currently ACTIVE season
 */
async function getActiveSeason() {
    const [rows] = await db_1.default.query('SELECT * FROM leaderboard_seasons WHERE status = "ACTIVE" ORDER BY id DESC LIMIT 1');
    if (rows && rows.length > 0) {
        return rows[0];
    }
    // Create default Season 1 if no active season exists
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const code = `SEASON-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const title = `Season 1 - Musim Belajar ${now.toLocaleString('id-ID', { month: 'long', year: 'numeric' })}`;
    const [res] = await db_1.default.query(`INSERT INTO leaderboard_seasons (title, code, start_date, end_date, reset_schedule_type, status)
     VALUES (?, ?, ?, ?, 'MONTHLY', 'ACTIVE')`, [title, code, startOfMonth, endOfMonth]);
    return {
        id: res.insertId,
        title,
        code,
        start_date: startOfMonth.toISOString(),
        end_date: endOfMonth.toISOString(),
        reset_schedule_type: 'MONTHLY',
        status: 'ACTIVE'
    };
}
/**
 * Calculate next season dates according to schedule type
 */
function calculateNextDates(scheduleType, customStart, customEnd) {
    const now = new Date();
    let startDate = customStart || now;
    let endDate = customEnd;
    if (!endDate) {
        if (scheduleType === 'MONTHLY') {
            // 1 month from now or end of next month
            const nextMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59);
            endDate = nextMonth;
        }
        else if (scheduleType === 'QUARTERLY') {
            // 3 months (triwulan)
            const nextQuarter = new Date(startDate.getFullYear(), startDate.getMonth() + 3, 0, 23, 59, 59);
            endDate = nextQuarter;
        }
        else {
            // Default 1 month
            endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
        }
    }
    return { startDate, endDate };
}
/**
 * Internal execution of season reset:
 * 1. Snapshot student rankings into leaderboard_season_history
 * 2. Mark previous season as COMPLETED
 * 3. Create new ACTIVE season
 * 4. Reset students' XP to 0 and level to 1
 */
async function executeSeasonReset(currentSeason, resetSource, options) {
    const conn = await db_1.default.getConnection();
    try {
        await conn.beginTransaction();
        console.log(`[SeasonService] Executing season reset (${resetSource}) for Season #${currentSeason.id} (${currentSeason.title})...`);
        // 1. Fetch current student rankings (role_id = 4)
        const [students] = await conn.query(`SELECT u.id as user_id, COALESCE(us.xp, 0) as xp, COALESCE(us.level, 1) as level
       FROM users u
       LEFT JOIN user_statistics us ON u.id = us.user_id
       WHERE u.role_id = 4
       ORDER BY xp DESC, level DESC`);
        // Fetch levels for naming
        const levels = await (0, levelService_1.getAllLevels)();
        const levelMap = new Map();
        levels.forEach(l => levelMap.set(l.level_number, l.name));
        // Archive into leaderboard_season_history
        if (students.length > 0) {
            for (let i = 0; i < students.length; i++) {
                const student = students[i];
                const rank = i + 1;
                const levelName = levelMap.get(student.level) || `Level ${student.level}`;
                await conn.query(`INSERT INTO leaderboard_season_history (season_id, user_id, final_rank, final_xp, final_level, level_name)
           VALUES (?, ?, ?, ?, ?, ?)`, [currentSeason.id, student.user_id, rank, student.xp, student.level, levelName]);
            }
        }
        // 2. Mark current season as COMPLETED
        await conn.query('UPDATE leaderboard_seasons SET status = "COMPLETED" WHERE id = ?', [currentSeason.id]);
        // 3. Determine next season properties
        const [totalSeasonsRows] = await conn.query('SELECT COUNT(*) as count FROM leaderboard_seasons');
        const nextSeasonNum = (totalSeasonsRows[0]?.count || 0) + 1;
        const scheduleType = options?.reset_schedule_type || currentSeason.reset_schedule_type || 'MONTHLY';
        const { startDate, endDate } = calculateNextDates(scheduleType, options?.start_date ? new Date(options.start_date) : new Date(), options?.end_date ? new Date(options.end_date) : undefined);
        const now = new Date();
        const defaultTitle = `Season ${nextSeasonNum} - Musim Belajar ${now.toLocaleString('id-ID', { month: 'long', year: 'numeric' })}`;
        const newTitle = options?.title || defaultTitle;
        const newCode = options?.code || `SEASON-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${nextSeasonNum}`;
        const [newSeasonResult] = await conn.query(`INSERT INTO leaderboard_seasons (title, code, start_date, end_date, reset_schedule_type, status)
       VALUES (?, ?, ?, ?, ?, 'ACTIVE')`, [newTitle, newCode, startDate, endDate, scheduleType]);
        const newSeasonId = newSeasonResult.insertId;
        // 4. Reset all student XP to 0 and level to 1 (Level 1 is Novice)
        await conn.query(`UPDATE user_statistics 
       SET xp = 0, level = 1 
       WHERE user_id IN (SELECT id FROM users WHERE role_id = 4)`);
        await conn.commit();
        console.log(`[SeasonService] Season reset completed! New Season #${newSeasonId} created. ${students.length} students reset to 0 XP.`);
        return {
            previousSeason: currentSeason,
            newSeason: {
                id: newSeasonId,
                title: newTitle,
                code: newCode,
                start_date: startDate.toISOString(),
                end_date: endDate.toISOString(),
                reset_schedule_type: scheduleType,
                status: 'ACTIVE'
            },
            archivedStudentsCount: students.length
        };
    }
    catch (error) {
        await conn.rollback();
        console.error('[SeasonService] Failed to reset season:', error);
        throw error;
    }
    finally {
        conn.release();
    }
}
/**
 * Check if the active season has expired; if so, automatically triggers reset
 */
async function checkAndProcessSeasonExpiry() {
    try {
        const activeSeason = await getActiveSeason();
        if (!activeSeason || !activeSeason.end_date)
            return null;
        const now = new Date();
        const expiryDate = new Date(activeSeason.end_date);
        if (now >= expiryDate) {
            console.log(`[SeasonService] Active season #${activeSeason.id} reached end date (${expiryDate.toISOString()}). Automatically resetting...`);
            return await executeSeasonReset(activeSeason, 'AUTO_SCHEDULED');
        }
        return null;
    }
    catch (err) {
        console.error('[SeasonService] Error checking season expiry:', err.message);
        return null;
    }
}
/**
 * Manual reset triggered by Admin
 */
async function resetSeasonManually(options) {
    const activeSeason = await getActiveSeason();
    return await executeSeasonReset(activeSeason, 'MANUAL', options);
}
/**
 * Background scheduler initialized on app startup
 */
let schedulerInterval = null;
function initSeasonScheduler() {
    if (schedulerInterval) {
        clearInterval(schedulerInterval);
    }
    // Check immediately on startup
    checkAndProcessSeasonExpiry().catch(err => {
        console.error('[SeasonService] Initial season check error:', err.message);
    });
    // Then check every 30 minutes
    const INTERVAL_MS = 30 * 60 * 1000;
    schedulerInterval = setInterval(() => {
        checkAndProcessSeasonExpiry().catch(err => {
            console.error('[SeasonService] Periodic season check error:', err.message);
        });
    }, INTERVAL_MS);
    console.log('[SeasonService] Leaderboard season auto-reset scheduler initialized (interval: 30 minutes).');
}
