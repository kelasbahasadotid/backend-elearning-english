import pool from '../config/db';

async function migrate() {
  const conn = await pool.getConnection();
  try {
    console.log('--- Migration: Add enforce_lesson_order to courses ---');

    // 1. Check if column already exists
    const [columns]: any = await conn.query(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'courses' 
         AND COLUMN_NAME = 'enforce_lesson_order'`
    );

    if (columns && columns.length > 0) {
      console.log('Column enforce_lesson_order already exists in table courses.');
    } else {
      console.log('Adding column enforce_lesson_order to table courses...');
      await conn.query(`
        ALTER TABLE courses 
        ADD COLUMN enforce_lesson_order TINYINT(1) NOT NULL DEFAULT 1 
        COMMENT '1 = enforce sequential lesson order, 0 = allow free navigation without lock'
        AFTER access_days
      `);
      console.log('Column enforce_lesson_order added successfully.');
    }

    // 2. Course ID 7: "[Bonus] English Beginner - 88 Video & 33 PPT"
    // Set enforce_lesson_order = 0 as requested in BE-REVISI20sep2027.md
    console.log('Setting enforce_lesson_order = 0 for Course ID 7 (Bonus English Beginner)...');
    const [updateResult]: any = await conn.query(`
      UPDATE courses 
      SET enforce_lesson_order = 0 
      WHERE id = 7 OR slug LIKE '%english-beginner%' OR title LIKE '%[Bonus] English Beginner%'
    `);
    console.log(`Updated ${updateResult.affectedRows || 0} course row(s) to enforce_lesson_order = 0.`);

    // 3. Verify column status
    const [verifyRows]: any = await conn.query(`
      SELECT id, title, slug, enforce_lesson_order 
      FROM courses 
      WHERE id = 7 OR enforce_lesson_order = 0 
      LIMIT 5
    `);
    console.log('Courses with free order:', verifyRows);

    console.log('Migration finished successfully!');
  } catch (err: any) {
    console.error('Migration failed:', err.message);
    throw err;
  } finally {
    conn.release();
    process.exit(0);
  }
}

migrate().catch(() => process.exit(1));
