import pool from '../src/config/db';

async function test() {
  try {
    const [cols]: any = await pool.query('DESCRIBE course_versions');
    console.log('course_versions columns:', cols.map((c: any) => c.Field));

    const [lessons]: any = await pool.query(`
      SELECT 
        l.id as lesson_id, 
        l.title as lesson_title, 
        l.lesson_type, 
        m.id as module_id, 
        m.title as module_title, 
        c.id as course_id, 
        c.title as course_title
      FROM lessons l
      JOIN modules m ON l.module_id = m.id
      JOIN course_versions cv ON m.course_version_id = cv.id
      JOIN courses c ON cv.course_id = c.id
      WHERE l.lesson_type IN ('READING', 'VIDEO')
      ORDER BY c.title, m.module_order, l.lesson_order
    `);
    console.log('Found Reading & Video lessons count:', lessons.length);
    console.log('Reading & Video sample:', lessons.slice(0, 5));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

test();
