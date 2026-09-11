import pool from '../src/config/db';

async function test() {
  const [users]: any = await pool.query('SELECT COUNT(*) as c FROM users WHERE role_id = 4');
  const [stats]: any = await pool.query('SELECT COUNT(*) as c, MAX(xp) as maxXp, AVG(xp) as avgXp FROM user_statistics');
  const [tx]: any = await pool.query('SELECT COUNT(*) as c FROM xp_transactions');
  const [levels]: any = await pool.query('SELECT * FROM gamification_levels ORDER BY level_number');
  const [seasons]: any = await pool.query('SELECT * FROM leaderboard_seasons');
  console.log('Students:', users[0].c);
  console.log('Stats:', stats[0]);
  console.log('Transactions:', tx[0].c);
  console.log('Levels count:', levels.length);
  console.log('Seasons count:', seasons.length);
  process.exit(0);
}

test().catch(e => { console.error(e); process.exit(1); });
