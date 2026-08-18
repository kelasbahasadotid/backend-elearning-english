import pool from '../src/config/db';

async function test() {
  try {
    const [qCols]: any = await pool.query('DESCRIBE questions');
    console.log('questions columns:', qCols.map((c: any) => `${c.Field} (${c.Type})`));
    const [oCols]: any = await pool.query('DESCRIBE question_options');
    console.log('question_options columns:', oCols.map((c: any) => `${c.Field} (${c.Type})`));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

test();
