import pool from '../src/config/db';

async function test() {
  try {
    const [modCols]: any = await pool.query('DESCRIBE modules');
    console.log('modules columns:', modCols.map((c: any) => c.Field));
    const [lesCols]: any = await pool.query('DESCRIBE lessons');
    console.log('lessons columns:', lesCols.map((c: any) => c.Field));

    const [modules]: any = await pool.query('SELECT * FROM modules LIMIT 5');
    console.log('Sample modules:', modules);
    const [lessons]: any = await pool.query('SELECT * FROM lessons LIMIT 5');
    console.log('Sample lessons:', lessons);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

test();
