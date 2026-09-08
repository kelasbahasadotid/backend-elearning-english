import { PoolConnection } from 'mysql2/promise';
import { getLevelByXp } from '../services/levelService';
import { getActiveSeason } from '../services/seasonService';

/**
 * Adds an XP transaction and updates the overall user statistics (XP balance and Level)
 */
export const addXpTransaction = async (
  connection: any,
  userId: number,
  activityType: 'LOGIN' | 'LESSON' | 'VIDEO' | 'QUIZ' | 'EXAM' | 'SPEAKING' | 'READING' | 'LISTENING' | 'ASSIGNMENT' | 'BONUS',
  xpAmount: number,
  referenceId: number | null,
  description: string
) => {
  // 1. Get active season id
  let seasonId: number | null = null;
  try {
    const activeSeason = await getActiveSeason();
    if (activeSeason) {
      seasonId = activeSeason.id;
    }
  } catch (err) {
    console.warn('[XP] Failed to get active season id:', err);
  }

  // 2. Insert transaction log with season_id
  await connection.query(
    'INSERT INTO xp_transactions (user_id, season_id, activity_type, reference_id, xp, description) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, seasonId, activityType, referenceId, xpAmount, description]
  );

  // 3. Check current user statistics
  const [stats]: any = await connection.query(
    'SELECT xp FROM user_statistics WHERE user_id = ?',
    [userId]
  );

  let currentXp = 0;
  if (stats && stats.length > 0) {
    currentXp = Number(stats[0].xp || 0);
  }

  const nextXp = Math.max(0, currentXp + xpAmount);
  const progression = await getLevelByXp(nextXp);
  const nextLevel = progression.level;

  if (stats && stats.length > 0) {
    await connection.query(
      'UPDATE user_statistics SET xp = ?, level = ? WHERE user_id = ?',
      [nextXp, nextLevel, userId]
    );
  } else {
    await connection.query(
      'INSERT INTO user_statistics (user_id, xp, level) VALUES (?, ?, ?)',
      [userId, nextXp, nextLevel]
    );
  }
  
  return {
    xp: nextXp,
    level: nextLevel,
    levelName: progression.levelName,
    badgeIcon: progression.badgeIcon,
    nextLevel: progression.nextLevel,
    nextLevelName: progression.nextLevelName,
    progressPercent: progression.progressPercent
  };
};

