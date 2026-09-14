"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllLevels = getAllLevels;
exports.getLevelByXp = getLevelByXp;
exports.upsertLevel = upsertLevel;
exports.deleteLevel = deleteLevel;
exports.bulkSaveLevels = bulkSaveLevels;
const db_1 = __importDefault(require("../config/db"));
/**
 * Fetch all configured levels ordered by level_number ascending
 */
async function getAllLevels() {
    const [rows] = await db_1.default.query('SELECT id, level_number, name, min_xp, badge_icon, description, created_at, updated_at FROM gamification_levels ORDER BY level_number ASC');
    return rows;
}
/**
 * Calculate dynamic level and progress information given an XP value
 */
async function getLevelByXp(xp) {
    const levels = await getAllLevels();
    if (!levels || levels.length === 0) {
        // Default fallback if table is empty
        const lvlNum = Math.max(1, Math.floor(xp / 200) + 1);
        const currMin = (lvlNum - 1) * 200;
        const nextMin = lvlNum * 200;
        return {
            level: lvlNum,
            levelName: `Level ${lvlNum}`,
            badgeIcon: '⭐',
            description: null,
            currentLevelMinXp: currMin,
            nextLevel: lvlNum + 1,
            nextLevelName: `Level ${lvlNum + 1}`,
            nextLevelMinXp: nextMin,
            xpNeededForNext: Math.max(0, nextMin - xp),
            progressPercent: Math.min(100, Math.max(0, Math.floor(((xp - currMin) / (nextMin - currMin)) * 100)))
        };
    }
    // Find the highest level where xp >= min_xp
    let currentLevelIdx = 0;
    for (let i = 0; i < levels.length; i++) {
        if (xp >= levels[i].min_xp) {
            currentLevelIdx = i;
        }
        else {
            break;
        }
    }
    const current = levels[currentLevelIdx];
    const next = currentLevelIdx + 1 < levels.length ? levels[currentLevelIdx + 1] : null;
    let progressPercent = 100;
    let xpNeeded = 0;
    if (next) {
        const range = next.min_xp - current.min_xp;
        const gainedInLevel = xp - current.min_xp;
        progressPercent = range > 0 ? Math.min(100, Math.max(0, Math.floor((gainedInLevel / range) * 100))) : 0;
        xpNeeded = Math.max(0, next.min_xp - xp);
    }
    return {
        level: current.level_number,
        levelName: current.name,
        badgeIcon: current.badge_icon,
        description: current.description,
        currentLevelMinXp: current.min_xp,
        nextLevel: next ? next.level_number : null,
        nextLevelName: next ? next.name : null,
        nextLevelMinXp: next ? next.min_xp : null,
        xpNeededForNext: xpNeeded,
        progressPercent
    };
}
/**
 * Upsert a single level configuration
 */
async function upsertLevel(data) {
    const { id, level_number, name, min_xp, badge_icon = null, description = null } = data;
    if (id) {
        await db_1.default.query('UPDATE gamification_levels SET level_number = ?, name = ?, min_xp = ?, badge_icon = ?, description = ? WHERE id = ?', [level_number, name, min_xp, badge_icon, description, id]);
        return { id, ...data };
    }
    else {
        const [res] = await db_1.default.query(`INSERT INTO gamification_levels (level_number, name, min_xp, badge_icon, description) 
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), min_xp = VALUES(min_xp), badge_icon = VALUES(badge_icon), description = VALUES(description)`, [level_number, name, min_xp, badge_icon, description]);
        return { id: res.insertId, ...data };
    }
}
/**
 * Delete a level (Level 1 cannot be deleted)
 */
async function deleteLevel(id) {
    const [rows] = await db_1.default.query('SELECT level_number FROM gamification_levels WHERE id = ?', [id]);
    if (!rows || rows.length === 0) {
        throw new Error('Level not found');
    }
    if (rows[0].level_number === 1) {
        throw new Error('Level 1 adalah level dasar dan tidak dapat dihapus');
    }
    await db_1.default.query('DELETE FROM gamification_levels WHERE id = ?', [id]);
    return true;
}
/**
 * Bulk save all level configurations from Admin
 */
async function bulkSaveLevels(levels) {
    if (!Array.isArray(levels) || levels.length === 0) {
        throw new Error('Levels array is required');
    }
    const conn = await db_1.default.getConnection();
    try {
        await conn.beginTransaction();
        // Ensure level 1 exists in the incoming payload
        const hasLevelOne = levels.some(l => Number(l.level_number) === 1);
        if (!hasLevelOne) {
            throw new Error('Konfigurasi harus menyertakan Level 1');
        }
        // Sort by level_number
        levels.sort((a, b) => Number(a.level_number) - Number(b.level_number));
        for (const lvl of levels) {
            if (lvl.id) {
                await conn.query('UPDATE gamification_levels SET level_number = ?, name = ?, min_xp = ?, badge_icon = ?, description = ? WHERE id = ?', [lvl.level_number, lvl.name, lvl.min_xp, lvl.badge_icon || null, lvl.description || null, lvl.id]);
            }
            else {
                await conn.query(`INSERT INTO gamification_levels (level_number, name, min_xp, badge_icon, description)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE name = VALUES(name), min_xp = VALUES(min_xp), badge_icon = VALUES(badge_icon), description = VALUES(description)`, [lvl.level_number, lvl.name, lvl.min_xp, lvl.badge_icon || null, lvl.description || null]);
            }
        }
        await conn.commit();
        return await getAllLevels();
    }
    catch (error) {
        await conn.rollback();
        throw error;
    }
    finally {
        conn.release();
    }
}
