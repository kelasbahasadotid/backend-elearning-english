import pool from '../src/config/db';

async function test() {
  const [history]: any = await pool.query('SELECT season_id, COUNT(*) as count, MAX(final_xp) as top_xp FROM leaderboard_season_history GROUP BY season_id');
  console.log('Season history archives:', history);
  process.exit(0);
}

test().catch(e => { console.error(e); process.exit(1); });
