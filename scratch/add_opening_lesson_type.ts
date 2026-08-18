import pool from '../src/config/db';

async function migrate() {
  const conn = await pool.getConnection();
  try {
    console.log('Adding OPENING to lessons.lesson_type ENUM...');
    await conn.query(`
      ALTER TABLE lessons 
      MODIFY COLUMN lesson_type ENUM('VIDEO','READING','QUIZ','SPEAKING','EXAM','FILL_BLANK','TRUE_FALSE','ORDERING','MULTIPLE_CHOICE','OPENING') NOT NULL DEFAULT 'VIDEO'
    `);
    console.log('SUCCESS: lessons.lesson_type ENUM now includes OPENING');
  } catch (error) {
    const e = error as any;
    console.error('Migration failed:', e.message);
  } finally {
    conn.release();
    process.exit(0);
  }
}
migrate();
