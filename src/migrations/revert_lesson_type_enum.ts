import pool from '../config/db';

async function revertEnum() {
  const conn = await pool.getConnection();
  try {
    console.log('Reverting lesson_type ENUM to 5 core types...');
    await conn.query(`
      ALTER TABLE lessons 
      MODIFY COLUMN lesson_type ENUM('VIDEO', 'READING', 'QUIZ', 'SPEAKING', 'EXAM') NOT NULL DEFAULT 'VIDEO'
    `);
    console.log('SUCCESS: lesson_type ENUM reverted to VIDEO, READING, QUIZ, SPEAKING, EXAM');
  } catch (e: any) {
    console.error('FAILED:', e.message);
  } finally {
    conn.release();
    process.exit(0);
  }
}
revertEnum();
