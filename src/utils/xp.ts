import { PoolConnection } from 'mysql2/promise';

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
  // 1. Insert transaction log
  await connection.query(
    'INSERT INTO xp_transactions (user_id, activity_type, reference_id, xp, description) VALUES (?, ?, ?, ?, ?)',
    [userId, activityType, referenceId, xpAmount, description]
  );

  // 2. Check if user statistics entry exists
  const [stats]: any = await connection.query(
    'SELECT xp FROM user_statistics WHERE user_id = ?',
    [userId]
  );

  let currentXp = 0;
  if (stats && stats.length > 0) {
    currentXp = Number(stats[0].xp || 0);
  }

  const nextXp = currentXp + xpAmount;
  const nextLevel = Math.floor(nextXp / 200) + 1;

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
  
  return { xp: nextXp, level: nextLevel };
};
